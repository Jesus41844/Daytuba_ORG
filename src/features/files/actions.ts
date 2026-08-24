"use server";

import { getStorage } from "firebase-admin/storage";
import { getDb } from "@/lib/db/server";
import { requireSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";

export async function uploadTaskPdf(
  taskId: string,
  file: File
): Promise<ActionResult<{ url: string; name: string }>> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const taskDoc = await db.collection("tasks").doc(taskId).get();
    if (!taskDoc.exists) {
      return { success: false, error: "La tarea no existe" };
    }
    if (taskDoc.get("userId") !== session.uid) {
      return { success: false, error: "No autorizado" };
    }

    const allowedTypes = ["application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: "Solo se permiten archivos PDF" };
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: "El archivo no puede superar 10MB" };
    }

    const storage = getStorage();
    const bucket = storage.bucket();
    const fileName = `${session.uid}/${taskId}/${Date.now()}_${file.name}`;
    const fileRef = bucket.file(fileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fileRef.save(buffer, {
      contentType: "application/pdf",
      metadata: {
        customMetadata: {
          taskId,
          userId: session.uid,
          originalName: file.name,
        },
      },
    });

    await fileRef.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    await db.collection("tasks").doc(taskId).update({
      pdfUrl: url,
      pdfName: file.name,
      updatedAt: new Date(),
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);

    return { success: true, data: { url, name: file.name } };
  } catch (error) {
    console.error("Error uploading PDF:", error);
    return { success: false, error: "Error al subir el PDF" };
  }
}

export async function deleteTaskPdf(
  taskId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const taskDoc = await db.collection("tasks").doc(taskId).get();
    if (!taskDoc.exists) {
      return { success: false, error: "La tarea no existe" };
    }
    if (taskDoc.get("userId") !== session.uid) {
      return { success: false, error: "No autorizado" };
    }

    const currentPdfUrl = taskDoc.get("pdfUrl");
    if (!currentPdfUrl) {
      return { success: false, error: "No hay PDF para eliminar" };
    }

    const storage = getStorage();
    const bucket = storage.bucket();

    const urlParts = currentPdfUrl.split(`/${bucket.name}/`);
    if (urlParts.length > 1) {
      const filePath = decodeURIComponent(urlParts[1]);
      await bucket.file(filePath).delete().catch(() => {});
    }

    await db.collection("tasks").doc(taskId).update({
      pdfUrl: null,
      pdfName: null,
      updatedAt: new Date(),
    });

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
    const db = await getDb();

    const blockDoc = await db.collection("schedule_blocks").doc(blockId).get();
    if (!blockDoc.exists) {
      return { success: false, error: "El bloque no existe" };
    }
    if (blockDoc.get("userId") !== session.uid) {
      return { success: false, error: "No autorizado" };
    }

    const allowedTypes = ["application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: "Solo se permiten archivos PDF" };
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: "El archivo no puede superar 10MB" };
    }

    const storage = getStorage();
    const bucket = storage.bucket();
    const fileName = `${session.uid}/schedule/${blockId}/${Date.now()}_${file.name}`;
    const fileRef = bucket.file(fileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fileRef.save(buffer, {
      contentType: "application/pdf",
      metadata: {
        customMetadata: {
          blockId,
          userId: session.uid,
          originalName: file.name,
        },
      },
    });

    await fileRef.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    await db.collection("schedule_blocks").doc(blockId).update({
      pdfUrl: url,
      pdfName: file.name,
    });

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
    const db = await getDb();

    const blockDoc = await db.collection("schedule_blocks").doc(blockId).get();
    if (!blockDoc.exists) {
      return { success: false, error: "El bloque no existe" };
    }
    if (blockDoc.get("userId") !== session.uid) {
      return { success: false, error: "No autorizado" };
    }

    const currentPdfUrl = blockDoc.get("pdfUrl");
    if (!currentPdfUrl) {
      return { success: false, error: "No hay PDF para eliminar" };
    }

    const storage = getStorage();
    const bucket = storage.bucket();

    const urlParts = currentPdfUrl.split(`/${bucket.name}/`);
    if (urlParts.length > 1) {
      const filePath = decodeURIComponent(urlParts[1]);
      await bucket.file(filePath).delete().catch(() => {});
    }

    await db.collection("schedule_blocks").doc(blockId).update({
      pdfUrl: null,
      pdfName: null,
    });

    revalidatePath("/dashboard/calendar");

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting schedule PDF:", error);
    return { success: false, error: "Error al eliminar el PDF" };
  }
}
