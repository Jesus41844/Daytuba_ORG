"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { moodleCredentials, projects } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/errors";
import { AppError, NotFoundError } from "@/lib/errors";
import { encrypt } from "./lib/crypto";
import { syncMoodleCredentialRow } from "./lib/sync";
import type { MoodleCredentials, MoodlePlatform, MoodleSyncResult } from "./types";

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

    const result = await syncMoodleCredentialRow(credRow);

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (error) {
    console.error("Error syncing Moodle:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al sincronizar con Moodle",
    };
  }
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
