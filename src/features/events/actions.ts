"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/db/server";
import { requireSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/errors";
import type { CalendarEvent } from "./types";

function mapEvent(doc: FirebaseFirestore.DocumentSnapshot): CalendarEvent {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    userId: (data.userId as string) ?? "",
    title: (data.title as string) ?? "",
    startTime: (data.startTime as string) ?? "09:00",
    endTime: (data.endTime as string) ?? "10:00",
    color: (data.color as string) ?? "#0b57d0",
    date: (data.date as string) ?? null,
    dayOfWeek: (data.dayOfWeek as number) ?? null,
    createdAt: data.createdAt instanceof Date
      ? data.createdAt.toISOString()
      : typeof data.createdAt === "string"
        ? data.createdAt
        : new Date().toISOString(),
  };
}

export async function getUserEvents(): Promise<CalendarEvent[]> {
  const session = await requireSession();
  const db = await getDb();

  const snapshot = await db
    .collection("calendar_events")
    .where("userId", "==", session.uid)
    .get();

  return snapshot.docs.map(mapEvent);
}

export async function createEvent(
  data: Omit<CalendarEvent, "id" | "userId" | "createdAt">
): Promise<ActionResult<CalendarEvent>> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const ref = db.collection("calendar_events").doc();
    const now = new Date().toISOString();

    const event: CalendarEvent = {
      id: ref.id,
      userId: session.uid,
      ...data,
      createdAt: now,
    };

    await ref.set({
      ...event,
      createdAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/dashboard/calendar");
    return { success: true, data: event };
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
    const db = await getDb();

    const doc = await db.collection("calendar_events").doc(id).get();
    if (!doc.exists) {
      return { success: false, error: "Evento no encontrado" };
    }
    if (doc.get("userId") !== session.uid) {
      return { success: false, error: "No autorizado" };
    }

    await doc.ref.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await doc.ref.get();
    revalidatePath("/dashboard/calendar");
    return { success: true, data: mapEvent(updated) };
  } catch (error) {
    console.error("Error updating event:", error);
    return { success: false, error: "Error al actualizar el evento" };
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const doc = await db.collection("calendar_events").doc(id).get();
    if (!doc.exists) {
      return { success: false, error: "Evento no encontrado" };
    }
    if (doc.get("userId") !== session.uid) {
      return { success: false, error: "No autorizado" };
    }

    await doc.ref.delete();
    revalidatePath("/dashboard/calendar");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { success: false, error: "Error al eliminar el evento" };
  }
}
