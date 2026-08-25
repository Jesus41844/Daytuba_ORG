"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/errors";
import type { CalendarEvent } from "./types";

function mapEvent(row: typeof calendarEvents.$inferSelect): CalendarEvent {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    startTime: row.startTime,
    endTime: row.endTime,
    color: row.color,
    date: row.date,
    dayOfWeek: row.dayOfWeek,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getUserEvents(): Promise<CalendarEvent[]> {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.userId, session.uid));

  return rows.map(mapEvent);
}

export async function createEvent(
  data: Omit<CalendarEvent, "id" | "userId" | "createdAt">
): Promise<ActionResult<CalendarEvent>> {
  try {
    const session = await requireSession();

    const inserted = await db
      .insert(calendarEvents)
      .values({
        userId: session.uid,
        title: data.title,
        startTime: data.startTime ?? "09:00",
        endTime: data.endTime ?? "10:00",
        color: data.color ?? "#0b57d0",
        date: data.date ?? null,
        dayOfWeek: data.dayOfWeek ?? null,
      })
      .returning();

    revalidatePath("/dashboard/calendar");
    return { success: true, data: mapEvent(inserted[0]!) };
  } catch (error) {
    console.error("Error creating event:", error);
    return { success: false, error: "Error al crear el evento" };
  }
}

export async function updateEvent(
  id: string,
  data: Partial<Pick<CalendarEvent, "title" | "date" | "dayOfWeek" | "startTime" | "endTime" | "color">>
): Promise<ActionResult<CalendarEvent>> {
  try {
    const session = await requireSession();

    const rows = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .limit(1);

    if (!rows[0]) return { success: false, error: "Evento no encontrado" };
    if (rows[0].userId !== session.uid)
      return { success: false, error: "No autorizado" };

    const updated = await db
      .update(calendarEvents)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.date !== undefined && { date: data.date ?? null }),
        ...(data.dayOfWeek !== undefined && {
          dayOfWeek: data.dayOfWeek ?? null,
        }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.color !== undefined && { color: data.color }),
      })
      .where(eq(calendarEvents.id, id))
      .returning();

    revalidatePath("/dashboard/calendar");
    return { success: true, data: mapEvent(updated[0]!) };
  } catch (error) {
    console.error("Error updating event:", error);
    return { success: false, error: "Error al actualizar el evento" };
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select({ userId: calendarEvents.userId })
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .limit(1);

    if (!rows[0]) return { success: false, error: "Evento no encontrado" };
    if (rows[0].userId !== session.uid)
      return { success: false, error: "No autorizado" };

    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
    revalidatePath("/dashboard/calendar");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { success: false, error: "Error al eliminar el evento" };
  }
}
