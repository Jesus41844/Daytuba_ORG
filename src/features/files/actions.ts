"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { scheduleBlocks, tasks } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/errors";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function uploadsRoot(): string {
  const configured = process.env.UPLOADS_DIR;
  if (!configured) {
    throw new Error("UPLOADS_DIR no está configurada");
  }
  return path.resolve(configured);
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function removeStoredFile(pdfUrl: string | null): Promise<void> {
  if (!pdfUrl || !pdfUrl.startsWith("/api/files/")) return;
  const relative = pdfUrl.slice("/api/files/".length);
  const target = path.resolve(uploadsRoot(), relative);
  if (!target.startsWith(uploadsRoot() + path.sep)) return;
  await unlink(target).catch(() => {});
}

export async function uploadTaskPdf(
  taskId: string,
  file: File
): Promise<ActionResult<{ url: string; name: string }>> {
  try {
    const session = await requireSession();

    const taskRows = await db
      .select({ userId: tasks.userId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!taskRows[0]) return { success: false, error: "La tarea no existe" };
    if (taskRows[0].userId !== session.uid)
      return { success: false, error: "No autorizado" };

    if (file.type !== "application/pdf") {
      return { success: false, error: "Solo se permiten archivos PDF" };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { success: false, error: "El archivo no puede superar 10MB" };
    }

    const storedName = `${Date.now()}_${safeSegment(file.name)}`;
    const relativeKey = path.posix.join(
      "tasks",
      taskId,
      `${randomUUID()}_${storedName}`
    );
    const absolutePath = path.join(uploadsRoot(), relativeKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

    const url = `/api/files/${relativeKey}`;

    const oldRows = await db
      .select({ pdfUrl: tasks.pdfUrl })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    await removeStoredFile(oldRows[0]?.pdfUrl ?? null);

    await db
      .update(tasks)
      .set({ pdfUrl: url, pdfName: file.name, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);

    return { success: true, data: { url, name: file.name } };
  } catch (error) {
    console.error("Error uploading PDF:", error);
    return { success: false, error: "Error al subir el PDF" };
  }
}

export async function deleteTaskPdf(taskId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select({ userId: tasks.userId, pdfUrl: tasks.pdfUrl })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!rows[0]) return { success: false, error: "La tarea no existe" };
    if (rows[0].userId !== session.uid)
      return { success: false, error: "No autorizado" };
    if (!rows[0].pdfUrl)
      return { success: false, error: "No hay PDF para eliminar" };

    await removeStoredFile(rows[0].pdfUrl);

    await db
      .update(tasks)
      .set({ pdfUrl: null, pdfName: null, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting PDF:", error);
    return { success: false, error: "Error al eliminar el PDF" };
  }
}

export async function uploadScheduleBlockPdf(
  blockId: string,
  file: File
): Promise<ActionResult<{ url: string; name: string }>> {
  try {
    const session = await requireSession();

    const blockRows = await db
      .select({ userId: scheduleBlocks.userId })
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.id, blockId))
      .limit(1);

    if (!blockRows[0]) return { success: false, error: "El bloque no existe" };
    if (blockRows[0].userId !== session.uid)
      return { success: false, error: "No autorizado" };

    if (file.type !== "application/pdf") {
      return { success: false, error: "Solo se permiten archivos PDF" };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { success: false, error: "El archivo no puede superar 10MB" };
    }

    const storedName = `${Date.now()}_${safeSegment(file.name)}`;
    const relativeKey = path.posix.join("schedule", blockId, `${randomUUID()}_${storedName}`);
    const absolutePath = path.join(uploadsRoot(), relativeKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

    const url = `/api/files/${relativeKey}`;

    const oldRows = await db
      .select({ pdfUrl: scheduleBlocks.pdfUrl })
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.id, blockId))
      .limit(1);
    await removeStoredFile(oldRows[0]?.pdfUrl ?? null);

    await db
      .update(scheduleBlocks)
      .set({ pdfUrl: url, pdfName: file.name })
      .where(eq(scheduleBlocks.id, blockId));

    revalidatePath("/dashboard/calendar");

    return { success: true, data: { url, name: file.name } };
  } catch (error) {
    console.error("Error uploading schedule PDF:", error);
    return { success: false, error: "Error al subir el PDF" };
  }
}

export async function deleteScheduleBlockPdf(
  blockId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select({ userId: scheduleBlocks.userId, pdfUrl: scheduleBlocks.pdfUrl })
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.id, blockId))
      .limit(1);

    if (!rows[0]) return { success: false, error: "El bloque no existe" };
    if (rows[0].userId !== session.uid)
      return { success: false, error: "No autorizado" };
    if (!rows[0].pdfUrl)
      return { success: false, error: "No hay PDF para eliminar" };

    await removeStoredFile(rows[0].pdfUrl);

    await db
      .update(scheduleBlocks)
      .set({ pdfUrl: null, pdfName: null })
      .where(eq(scheduleBlocks.id, blockId));

    revalidatePath("/dashboard/calendar");

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting schedule PDF:", error);
    return { success: false, error: "Error al eliminar el PDF" };
  }
}
