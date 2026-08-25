"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { scheduleBlocks } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/errors";
import type { ScheduleBlock } from "./types";
import {
  parseSchedulePdfBuffer,
  type ParsedScheduleEntry,
} from "@/lib/schedule-pdf";

function mapScheduleBlock(
  row: typeof scheduleBlocks.$inferSelect
): ScheduleBlock {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    color: row.color,
    pdfUrl: row.pdfUrl,
    pdfName: row.pdfName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getUserSchedule(): Promise<ScheduleBlock[]> {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(scheduleBlocks)
    .where(eq(scheduleBlocks.userId, session.uid));

  return rows.map(mapScheduleBlock);
}

export async function createScheduleBlock(
  data: Omit<ScheduleBlock, "id" | "userId" | "createdAt">
): Promise<ActionResult<ScheduleBlock>> {
  try {
    const session = await requireSession();

    const inserted = await db
      .insert(scheduleBlocks)
      .values({
        userId: session.uid,
        name: data.name,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        color: data.color ?? "#0b57d0",
        pdfUrl: data.pdfUrl ?? null,
        pdfName: data.pdfName ?? null,
      })
      .returning();

    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/calendar");

    return { success: true, data: mapScheduleBlock(inserted[0]!) };
  } catch (error) {
    console.error("Error creating schedule block:", error);
    return { success: false, error: "Error al crear el bloque de horario" };
  }
}

export async function updateScheduleBlock(
  id: string,
  data: Partial<Pick<ScheduleBlock, "name" | "dayOfWeek" | "startTime" | "endTime" | "color">>
): Promise<ActionResult<ScheduleBlock>> {
  try {
    const session = await requireSession();

    const rows = await db
      .select()
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.id, id))
      .limit(1);

    if (!rows[0]) return { success: false, error: "Bloque no encontrado" };
    if (rows[0].userId !== session.uid)
      return { success: false, error: "No autorizado" };

    const updated = await db
      .update(scheduleBlocks)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.color !== undefined && { color: data.color }),
        updatedAt: new Date(),
      })
      .where(eq(scheduleBlocks.id, id))
      .returning();

    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/calendar");

    return { success: true, data: mapScheduleBlock(updated[0]!) };
  } catch (error) {
    console.error("Error updating schedule block:", error);
    return { success: false, error: "Error al actualizar el bloque" };
  }
}

export async function deleteScheduleBlock(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select({ userId: scheduleBlocks.userId })
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.id, id))
      .limit(1);

    if (!rows[0]) return { success: false, error: "Bloque no encontrado" };
    if (rows[0].userId !== session.uid)
      return { success: false, error: "No autorizado" };

    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id, id));

    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/calendar");

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting schedule block:", error);
    return { success: false, error: "Error al eliminar el bloque" };
  }
}

export async function parseSchedulePdf(
  formData: FormData
): Promise<ActionResult<ParsedScheduleEntry[]>> {
  try {
    const session = await requireSession();
    void session;

    const file = formData.get("pdf") as File | null;
    if (!file) {
      return { success: false, error: "No se envio ningun archivo" };
    }

    if (file.type !== "application/pdf") {
      return { success: false, error: "Solo se permiten archivos PDF" };
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: "El archivo no puede superar 10MB" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const entries = await parseSchedulePdfBuffer(arrayBuffer);

    return { success: true, data: entries };
  } catch (error) {
    console.error("Error parsing schedule PDF:", error);
    return { success: false, error: "Error al leer el PDF. Intenta con otro archivo." };
  }
}
