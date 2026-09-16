"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { scheduleBlocks, tasks } from "@/db/schema";
import { deleteBlobUrl, isBlobUrl } from "@/lib/blob";
import { requireSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/errors";

function blobUrlForOwner(
  kind: "tasks" | "schedule",
  ownerId: string,
  url: string
): boolean {
  if (!isBlobUrl(url)) return false;
  return url.includes(`/uploads/${kind}/${ownerId}/`);
}

export async function confirmTaskPdfUpload(
  taskId: string,
  blobUrl: string,
  fileName: string
): Promise<ActionResult> {
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
    if (!blobUrlForOwner("tasks", taskId, blobUrl))
      return { success: false, error: "Ruta inválida" };

    await deleteBlobUrl(rows[0].pdfUrl);

    await db
      .update(tasks)
      .set({ pdfUrl: blobUrl, pdfName: fileName, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error confirming task PDF upload:", error);
    return { success: false, error: "Error al subir el PDF" };
  }
}

export async function confirmScheduleBlockPdfUpload(
  blockId: string,
  blobUrl: string,
  fileName: string
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
    if (!blobUrlForOwner("schedule", blockId, blobUrl))
      return { success: false, error: "Ruta inválida" };

    await deleteBlobUrl(rows[0].pdfUrl);

    await db
      .update(scheduleBlocks)
      .set({ pdfUrl: blobUrl, pdfName: fileName })
      .where(eq(scheduleBlocks.id, blockId));

    revalidatePath("/dashboard/calendar");

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error confirming schedule PDF upload:", error);
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

    await deleteBlobUrl(rows[0].pdfUrl);

    await db
      .update(tasks)
      .set({ pdfUrl: null, pdfName: null, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting task PDF:", error);
    return { success: false, error: "Error al eliminar el PDF" };
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

    await deleteBlobUrl(rows[0].pdfUrl);

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