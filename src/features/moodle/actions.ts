"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getDb } from "@/lib/db/server";
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

function mapCredential(doc: FirebaseFirestore.DocumentSnapshot): MoodleCredentials {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    userId: (data.userId as string) ?? "",
    platform: (data.platform as MoodlePlatform) ?? "ecampus",
    username: (data.username as string) ?? "",
    encryptedPassword: (data.encryptedPassword as string) ?? "",
    iv: (data.iv as string) ?? "",
    tag: (data.tag as string) ?? "",
    lastSyncAt: data.lastSyncAt instanceof Date
      ? data.lastSyncAt.toISOString()
      : typeof data.lastSyncAt === "string"
        ? data.lastSyncAt
        : null,
    createdAt: data.createdAt instanceof Date
      ? data.createdAt.toISOString()
      : typeof data.createdAt === "string"
        ? data.createdAt
        : new Date().toISOString(),
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
    const db = await getDb();

    const existing = await db
      .collection("moodle_credentials")
      .where("userId", "==", session.uid)
      .where("platform", "==", platform)
      .get();

    const { ciphertext, iv, tag } = encrypt(password);

    if (!existing.empty) {
      const docRef = existing.docs[0]!.ref;
      await docRef.update({
        username,
        encryptedPassword: ciphertext,
        iv,
        tag,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const updated = await docRef.get();
      revalidatePath("/dashboard/settings");
      return { success: true, data: mapCredential(updated) };
    }

    const docRef = db.collection("moodle_credentials").doc();
    const now = new Date().toISOString();

    const cred: MoodleCredentials = {
      id: docRef.id,
      userId: session.uid,
      platform,
      username,
      encryptedPassword: ciphertext,
      iv,
      tag,
      lastSyncAt: null,
      createdAt: now,
    };

    await docRef.set({
      ...cred,
      createdAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/dashboard/settings");
    return { success: true, data: cred };
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
    const db = await getDb();

    const doc = await db.collection("moodle_credentials").doc(id).get();
    if (!doc.exists) throw new NotFoundError("Credencial");
    if (doc.get("userId") !== session.uid) throw new NotFoundError("Credencial");

    await doc.ref.delete();
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
  const db = await getDb();

  const snapshot = await db
    .collection("moodle_credentials")
    .where("userId", "==", session.uid)
    .get();

  return snapshot.docs.map(mapCredential);
}

export async function syncMoodlePlatform(
  credentialId: string
): Promise<ActionResult<MoodleSyncResult>> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const doc = await db.collection("moodle_credentials").doc(credentialId).get();
    if (!doc.exists) throw new NotFoundError("Credencial");
    if (doc.get("userId") !== session.uid) throw new NotFoundError("Credencial");

    const platform = doc.get("platform") as MoodlePlatform;
    const username = doc.get("username") as string;
    const encryptedPassword = doc.get("encryptedPassword") as string;
    const ivHex = doc.get("iv") as string;
    const tagHex = doc.get("tag") as string;

    const password = decrypt(encryptedPassword, ivHex, tagHex);
    const baseUrl = MOODLE_URLS[platform];

    const client = new MoodleClient({ baseUrl, username, password });
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
          .collection("projects")
          .where("userId", "==", session.uid)
          .where("moodleCourseId", "==", String(course.id))
          .where("moodlePlatform", "==", platform)
          .limit(1)
          .get();

        if (!existing.empty) {
          const doc = existing.docs[0]!;
          projectMap.set(course.id, doc.id);
          // Update name in case shortname changed
          if (doc.get("name") !== (course.shortname || course.fullname)) {
            await doc.ref.update({
              name: course.shortname || course.fullname,
              description: course.fullname !== course.shortname ? course.fullname : null,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        } else {
          const sortNum = await getNextProjectSortOrder(session.uid);
          const projectData = moodleCourseToProject(course, platform, session.uid);
          const projectRef = db.collection("projects").doc();
          await projectRef.set({
            ...projectData,
            id: projectRef.id,
            sortOrder: sortNum,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          projectMap.set(course.id, projectRef.id);
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
        const taskData = moodleEventToTask(
          event,
          courseMap.get(event.courseid),
          platform,
          session.uid,
          projectMap.get(event.courseid)
        );

        const existing = await db
          .collection("tasks")
          .where("userId", "==", session.uid)
          .where("moodleAssignmentId", "==", String(event.id))
          .where("moodlePlatform", "==", platform)
          .limit(1)
          .get();

        if (!existing.empty) {
          const taskDoc = existing.docs[0]!;
          const currentStatus = taskDoc.get("status");
          if (currentStatus === "completed" || currentStatus === "cancelled") {
            continue;
          }
          await taskDoc.ref.update({
            title: taskData.title,
            dueDate: taskData.dueDate,
            priority: taskData.priority,
            description: taskData.description,
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          const taskRef = db.collection("tasks").doc();
          await taskRef.set({
            ...taskData,
            id: taskRef.id,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } catch (err) {
        errors.push(
          `Error en evento ${event.id}: ${err instanceof Error ? err.message : "desconocido"}`
        );
      }
    }

    await doc.ref.update({
      lastSyncAt: FieldValue.serverTimestamp(),
    });

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
  const db = await getDb();
  try {
    const last = await db
      .collection("projects")
      .where("userId", "==", userId)
      .orderBy("sortOrder", "desc")
      .limit(1)
      .get();
    if (last.empty) return 0;
    return Number(last.docs[0].get("sortOrder") ?? -1) + 1;
  } catch {
    const all = await db
      .collection("projects")
      .where("userId", "==", userId)
      .get();
    if (all.empty) return 0;
    let max = -1;
    for (const doc of all.docs) {
      const val = Number(doc.get("sortOrder") ?? -1);
      if (val > max) max = val;
    }
    return max + 1;
  }
}

export async function unlinkMoodleProject(
  projectId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const doc = await db.collection("projects").doc(projectId).get();
    if (!doc.exists) throw new NotFoundError("Proyecto");
    if (doc.get("userId") !== session.uid) throw new NotFoundError("Proyecto");

    await doc.ref.update({
      moodleCourseId: null,
      moodlePlatform: null,
      moodleUrl: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

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
