import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import type { MoodleCredentialRow } from "@/db/schema";
import { moodleCredentials, projects, tasks } from "@/db/schema";
import { toDateOrNull } from "@/db/mappers";
import { createNotification } from "@/features/notifications/service";
import { decrypt } from "./crypto";
import { MoodleClient } from "./client";
import { moodleEventToTask, moodleCourseToProject, buildCourseMap } from "./parser";
import { MOODLE_PLATFORMS } from "../types";
import type { MoodleSyncResult } from "../types";

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

/**
 * Núcleo de sincronización para una sola credencial de Moodle. No depende de
 * sesión ni de contexto de request: lo reutilizan tanto la acción manual
 * (verificada por sesión, un usuario) como el barrido de cron (todas las
 * filas de `moodle_credentials`, de todos los usuarios).
 */
export async function syncMoodleCredentialRow(
  credRow: MoodleCredentialRow
): Promise<MoodleSyncResult> {
  const { userId, platform } = credRow;
  const password = decrypt(credRow.encryptedPassword, credRow.iv, credRow.tag);
  const baseUrl = MOODLE_PLATFORMS[platform].baseUrl;

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
            eq(projects.userId, userId),
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
                course.fullname !== course.shortname ? course.fullname : null,
              updatedAt: new Date(),
            })
            .where(eq(projects.id, current.id));
        }
      } else {
        const sortNum = await getNextProjectSortOrder(userId);
        const projectData = moodleCourseToProject(course, platform, userId);
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

  // Sync events → tasks (linked to projects), con detección de cambios en
  // tareas ya importadas (fecha/título) para notificar novedades.
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
        userId,
        projectId
      );
      const newDueDate = toDateOrNull(taskData.dueDate);

      const existing = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.moodleAssignmentId, String(event.id)),
            eq(tasks.moodlePlatform, platform)
          )
        )
        .limit(1);

      if (existing[0]) {
        const current = existing[0];
        const dueDateChanged =
          (current.dueDate?.getTime() ?? null) !== (newDueDate?.getTime() ?? null);
        const titleChanged = current.title !== taskData.title;

        if (current.status === "completed" || current.status === "cancelled") {
          // La tarea ya no es accionable: solo reflejamos la fecha (para que
          // el historial no quede desfasado) sin reabrirla ni notificar.
          if (dueDateChanged) {
            await db
              .update(tasks)
              .set({ dueDate: newDueDate, updatedAt: new Date() })
              .where(eq(tasks.id, current.id));
          }
          continue;
        }

        await db
          .update(tasks)
          .set({
            title: taskData.title,
            dueDate: newDueDate,
            priority: taskData.priority,
            description: taskData.description,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, current.id));

        if (dueDateChanged || titleChanged) {
          const changes = [
            dueDateChanged ? "cambió de fecha" : null,
            titleChanged ? `se renombró a "${taskData.title}"` : null,
          ].filter((v): v is string => v !== null);

          await createNotification({
            userId,
            type: "info",
            title: "Moodle actualizó una tarea",
            body: `"${current.title}" ${changes.join(" y ")}`,
            url: `/dashboard/tasks/${current.id}`,
          });
        }
      } else {
        await db.insert(tasks).values({
          ...taskData,
          startDate: toDateOrNull(taskData.startDate),
          dueDate: newDueDate,
          reminderAt: toDateOrNull(taskData.reminderAt),
          completedAt: null,
          sortOrder: await getNextTaskSortOrder(userId),
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
    .where(eq(moodleCredentials.id, credRow.id));

  return {
    platform,
    courses: courses.length,
    assignments: events.length,
    errors,
  };
}
