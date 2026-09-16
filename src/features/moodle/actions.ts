"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { moodleCredentials, projects, tasks } from "@/db/schema";
import { toDateOrNull } from "@/db/mappers";
import { requireSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/errors";
import { AppError, NotFoundError } from "@/lib/errors";
import { encrypt, decrypt } from "./lib/crypto";
import { MoodleClient } from "./lib/client";
import { moodleEventToTask, moodleCourseToProject, buildCourseMap } from "./lib/parser";
import type { MoodleCredentials, MoodlePlatform, MoodleSyncResult } from "./types";

const MOODLE_URLS: Record<MoodlePlatform, string> = {
  ecampus: "https://ecampus.utp.ac.pa/moodle",
  campusvirtual: "https://campusvirtual.utp.ac.pa/moodle",
  virtualutp: "https://virtual.utp.ac.pa/moodle",
};

const credentialSchema = z.object({
  platform: z.enum(["ecampus", "campusvirtual", "virtualutp"]),
  username: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

function mapCredential(
  row: typeof moodleCredentials.$inferSelect
): MoodleCredentials {
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform,
    username: row.username,
    encryptedPassword: row.encryptedPassword,
    iv: row.iv,
    tag: row.tag,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function saveMoodleCredentials(
  platform: MoodlePlatform,
  username: string,
  password: string
): Promise<ActionResult<MoodleCredentials>> {
  try {
    const parsed = credentialSchema.safeParse({ platform, username, password });
    if (!parsed.success) {
      return {
        success: false,
        error: "Error de validación",
        errors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      };
    }

    const session = await requireSession();

    const existing = await db
      .select()
      .from(moodleCredentials)
      .where(
        and(
          eq(moodleCredentials.userId, session.uid),
          eq(moodleCredentials.platform, platform)
        )
      )
      .limit(1);

    const { ciphertext, iv, tag } = encrypt(password);

    if (existing[0]) {
      const updated = await db
        .update(moodleCredentials)
        .set({
          username,
          encryptedPassword: ciphertext,
          iv,
          tag,
          updatedAt: new Date(),
        })
        .where(eq(moodleCredentials.id, existing[0].id))
        .returning();

      revalidatePath("/dashboard/settings");
      return { success: true, data: mapCredential(updated[0]!) };
    }

    const inserted = await db
      .insert(moodleCredentials)
      .values({
        userId: session.uid,
        platform,
        username,
        encryptedPassword: ciphertext,
        iv,
        tag,
      })
      .returning();

    revalidatePath("/dashboard/settings");
    return { success: true, data: mapCredential(inserted[0]!) };
  } catch (error) {
    console.error("Error saving Moodle credentials:", error);
    return { success: false, error: "Error al guardar credenciales" };
  }
}

export async function deleteMoodleCredentials(
  id: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select({ userId: moodleCredentials.userId })
      .from(moodleCredentials)
      .where(eq(moodleCredentials.id, id))
      .limit(1);

    if (!rows[0] || rows[0].userId !== session.uid)
      throw new NotFoundError("Credencial");

    await db.delete(moodleCredentials).where(eq(moodleCredentials.id, id));
    revalidatePath("/dashboard/settings");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    console.error("Error deleting Moodle credentials:", error);
    return { success: false, error: "Error al eliminar credencial" };
  }
}

export async function getUserMoodleCredentials(): Promise<MoodleCredentials[]> {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(moodleCredentials)
    .where(eq(moodleCredentials.userId, session.uid));

  return rows.map(mapCredential);
}

export async function syncMoodlePlatform(
  credentialId: string
): Promise<ActionResult<MoodleSyncResult>> {
  try {
    const session = await requireSession();

    const rows = await db
      .select()
      .from(moodleCredentials)
      .where(eq(moodleCredentials.id, credentialId))
      .limit(1);

    const credRow = rows[0];
    if (!credRow || credRow.userId !== session.uid)
      throw new NotFoundError("Credencial");

    const platform = credRow.platform;
    const password = decrypt(
      credRow.encryptedPassword,
      credRow.iv,
      credRow.tag
    );
    const baseUrl = MOODLE_URLS[platform];

    const client = new MoodleClient({
      baseUrl,
      username: credRow.username,
      password,
    });
    await client.login();

    const test = await client.testConnection();
    if (!test.valid) {
      throw new Error(
        `Sesión con ${baseUrl} no válida. Verifica tus credenciales y que la plataforma esté disponible.`
      );
    }

    const [courses, events] = await Promise.all([
      client.getEnrolledCourses(),
      client.getUpcomingEvents(60),
    ]);

    const courseMap = buildCourseMap(courses);
    const projectMap = new Map<number, string>(); // courseId → projectId
    const errors: string[] = [];

    // Sync courses → projects
    for (const course of courses) {
      try {
        const existing = await db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.userId, session.uid),
              eq(projects.moodleCourseId, String(course.id)),
              eq(projects.moodlePlatform, platform)
            )
          )
          .limit(1);

        if (existing[0]) {
          const current = existing[0];
          projectMap.set(course.id, current.id);
          // Update name in case shortname changed
          if (current.name !== (course.shortname || course.fullname)) {
            await db
              .update(projects)
              .set({
                name: course.shortname || course.fullname,
                description:
                  course.fullname !== course.shortname
                    ? course.fullname
                    : null,
                updatedAt: new Date(),
              })
              .where(eq(projects.id, current.id));
          }
        } else {
          const sortNum = await getNextProjectSortOrder(session.uid);
          const projectData = moodleCourseToProject(
            course,
            platform,
            session.uid
          );
          const inserted = await db
            .insert(projects)
            .values({ ...projectData, sortOrder: sortNum })
            .returning();
          projectMap.set(course.id, inserted[0]!.id);
        }
      } catch (err) {
        errors.push(
          `Error en curso ${course.shortname}: ${err instanceof Error ? err.message : "desconocido"}`
        );
      }
    }

    // Sync events → tasks (linked to projects)
    for (const event of events) {
      try {
        const course =
          event.courseid != null ? courseMap.get(event.courseid) : undefined;
        const projectId =
          event.courseid != null ? projectMap.get(event.courseid) : undefined;

        const taskData = moodleEventToTask(
          event,
          course,
          platform,
          session.uid,
          projectId
        );

        const existing = await db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, session.uid),
              eq(tasks.moodleAssignmentId, String(event.id)),
              eq(tasks.moodlePlatform, platform)
            )
          )
          .limit(1);

        if (existing[0]) {
          const current = existing[0];
          if (
            current.status === "completed" ||
            current.status === "cancelled"
          ) {
            continue;
          }
          await db
            .update(tasks)
            .set({
              title: taskData.title,
              dueDate: toDateOrNull(taskData.dueDate),
              priority: taskData.priority,
              description: taskData.description,
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, current.id));
        } else {
          await db.insert(tasks).values({
            ...taskData,
            startDate: toDateOrNull(taskData.startDate),
            dueDate: toDateOrNull(taskData.dueDate),
            reminderAt: toDateOrNull(taskData.reminderAt),
            completedAt: null,
            sortOrder: await getNextTaskSortOrder(session.uid),
          });
        }
      } catch (err) {
        errors.push(
          `Error en evento ${event.id}: ${err instanceof Error ? err.message : "desconocido"}`
        );
      }
    }

    await db
      .update(moodleCredentials)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(moodleCredentials.id, credentialId));

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        platform,
        courses: courses.length,
        assignments: events.length,
        errors,
      },
    };
  } catch (error) {
    console.error("Error syncing Moodle:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al sincronizar con Moodle",
    };
  }
}

async function getNextProjectSortOrder(userId: string): Promise<number> {
  const rows = await db
    .select({ sortOrder: projects.sortOrder })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.sortOrder))
    .limit(1);

  return (rows[0]?.sortOrder ?? -1) + 1;
}

async function getNextTaskSortOrder(userId: string): Promise<number> {
  const rows = await db
    .select({ sortOrder: tasks.sortOrder })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.sortOrder))
    .limit(1);

  return (rows[0]?.sortOrder ?? -1) + 1;
}

export async function unlinkMoodleProject(
  projectId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!rows[0] || rows[0].userId !== session.uid)
      throw new NotFoundError("Proyecto");

    await db
      .update(projects)
      .set({
        moodleCourseId: null,
        moodlePlatform: null,
        moodleUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/inbox");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    console.error("Error unlinking Moodle project:", error);
    return { success: false, error: "Error al desvincular proyecto" };
  }
}

export async function syncAllMoodle(): Promise<ActionResult<MoodleSyncResult[]>> {
  try {
    const credentials = await getUserMoodleCredentials();
    if (credentials.length === 0) {
      return { success: true, data: [] };
    }

    const results: MoodleSyncResult[] = [];
    for (const cred of credentials) {
      const result = await syncMoodlePlatform(cred.id);
      if (result.success) {
        results.push(result.data);
      }
    }

    return { success: true, data: results };
  } catch (error) {
    console.error("Error syncing all Moodle:", error);
    return { success: false, error: "Error al sincronizar plataformas" };
  }
}
