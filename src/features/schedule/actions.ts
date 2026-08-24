"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/db/server";
import { requireSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/errors";
import type { ScheduleBlock } from "./types";
import {
  parseSchedulePdfBuffer,
  type ParsedScheduleEntry,
} from "@/lib/schedule-pdf";

function mapScheduleBlock(doc: FirebaseFirestore.DocumentSnapshot): ScheduleBlock {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    userId: (data.userId as string) ?? "",
    name: (data.name as string) ?? "",
    dayOfWeek: (data.dayOfWeek as number) ?? 0,
    startTime: (data.startTime as string) ?? "",
    endTime: (data.endTime as string) ?? "",
    color: (data.color as string) ?? "#0b57d0",
    pdfUrl: (data.pdfUrl as string) ?? null,
    pdfName: (data.pdfName as string) ?? null,
    createdAt: data.createdAt instanceof Date
      ? data.createdAt.toISOString()
      : typeof data.createdAt === "string"
        ? data.createdAt
        : new Date().toISOString(),
  };
}

export async function getUserSchedule(): Promise<ScheduleBlock[]> {
  const session = await requireSession();
  const db = await getDb();

  const snapshot = await db
    .collection("schedule_blocks")
    .where("userId", "==", session.uid)
    .get();

  return snapshot.docs.map(mapScheduleBlock);
}

export async function createScheduleBlock(
  data: Omit<ScheduleBlock, "id" | "userId" | "createdAt">
): Promise<ActionResult<ScheduleBlock>> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const ref = db.collection("schedule_blocks").doc();
    const now = new Date().toISOString();

    const block: ScheduleBlock = {
      id: ref.id,
      userId: session.uid,
      ...data,
      pdfUrl: data.pdfUrl ?? null,
      pdfName: data.pdfName ?? null,
      createdAt: now,
    };

    await ref.set({
      ...block,
      createdAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/calendar");

    return { success: true, data: block };
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
    const db = await getDb();

    const doc = await db.collection("schedule_blocks").doc(id).get();
    if (!doc.exists) {
      return { success: false, error: "Bloque no encontrado" };
    }
    if (doc.get("userId") !== session.uid) {
      return { success: false, error: "No autorizado" };
    }

    await doc.ref.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await doc.ref.get();

    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/calendar");

    return { success: true, data: mapScheduleBlock(updated) };
  } catch (error) {
    console.error("Error updating schedule block:", error);
    return { success: false, error: "Error al actualizar el bloque" };
  }
}

export async function deleteScheduleBlock(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const doc = await db.collection("schedule_blocks").doc(id).get();
    if (!doc.exists) {
      return { success: false, error: "Bloque no encontrado" };
    }
    if (doc.get("userId") !== session.uid) {
      return { success: false, error: "No autorizado" };
    }

    await doc.ref.delete();

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
