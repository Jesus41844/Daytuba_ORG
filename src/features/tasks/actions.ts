"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/db/server";
import { mapTask } from "@/lib/firebase/mappers";
import type { Task } from "@/types";
import { requireSession } from "@/lib/auth/session";
import {
  type ActionResult,
  AppError,
  NotFoundError,
} from "@/lib/errors";
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/lib/validations";

function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }
  console.error(error);
  return { success: false, error: "Ocurrió un error inesperado" };
}

function validationResult(error: z.ZodError): ActionResult<never> {
  return {
    success: false,
    error: "Error de validación",
    errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

async function findUserTask(id: string) {
  const session = await requireSession();
  const db = await getDb();

  const snapshot = await db.collection("tasks").doc(id).get();
  if (!snapshot.exists) throw new NotFoundError("La tarea");
  if (snapshot.get("userId") !== session.uid) throw new NotFoundError("La tarea");

  return { session, ref: snapshot.ref };
}

async function getNextSortOrder(userId: string): Promise<number> {
  const db = await getDb();
  try {
    const lastTask = await db
      .collection("tasks")
      .where("userId", "==", userId)
      .orderBy("sortOrder", "desc")
      .limit(1)
      .get();
    if (lastTask.empty) return 0;
    return Number(lastTask.docs[0].get("sortOrder") ?? -1) + 1;
  } catch {
    const allTasks = await db
      .collection("tasks")
      .where("userId", "==", userId)
      .get();
    if (allTasks.empty) return 0;
    let maxSort = -1;
    for (const doc of allTasks.docs) {
      const val = Number(doc.get("sortOrder") ?? -1);
      if (val > maxSort) maxSort = val;
    }
    return maxSort + 1;
  }
}

export async function createTask(
  data: CreateTaskInput
): Promise<ActionResult<Task>> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const parsed = createTaskSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const taskRef = db.collection("tasks").doc();
    const now = new Date().toISOString();

    const task: Task = {
      id: taskRef.id,
      userId: session.uid,
      projectId: parsed.data.projectId ?? null,
      parentId: parsed.data.parentId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: "pending",
      priority: parsed.data.priority,
      createdById: session.uid,
      createdByName: session.displayName,
      startDate: parsed.data.startDate ?? null,
      dueDate: parsed.data.dueDate ?? null,
      estimatedHours: parsed.data.estimatedHours ?? null,
      actualHours: null,
      completedAt: null,
      recurrence:
        parsed.data.recurrence === "none" ? null : parsed.data.recurrence,
      isArchived: false,
      sortOrder: await getNextSortOrder(session.uid),
      categories: parsed.data.categories ?? [],
      pdfUrl: null,
      pdfName: null,
      source: "manual",
      moodlePlatform: null,
      moodleCourseId: null,
      moodleAssignmentId: null,
      moodleUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    await taskRef.set({
      ...task,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: task };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateTask(
  id: string,
  data: UpdateTaskInput
): Promise<ActionResult<Task>> {
  try {
    const parsed = updateTaskSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const { ref } = await findUserTask(id);

    const values: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) values.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      values.description = parsed.data.description ?? null;
    if (parsed.data.projectId !== undefined)
      values.projectId = parsed.data.projectId ?? null;
    if (parsed.data.priority !== undefined)
      values.priority = parsed.data.priority;
    if (parsed.data.startDate !== undefined)
      values.startDate = parsed.data.startDate ?? null;
    if (parsed.data.dueDate !== undefined)
      values.dueDate = parsed.data.dueDate ?? null;
    if (parsed.data.estimatedHours !== undefined)
      values.estimatedHours = parsed.data.estimatedHours ?? null;
    if (parsed.data.parentId !== undefined)
      values.parentId = parsed.data.parentId ?? null;
    if (parsed.data.recurrence !== undefined) {
      values.recurrence =
        parsed.data.recurrence === "none" ? null : parsed.data.recurrence;
    }
    if (parsed.data.status !== undefined) {
      values.status = parsed.data.status;
      values.completedAt =
        parsed.data.status === "completed" ? new Date().toISOString() : null;
    }
    if (parsed.data.isArchived !== undefined)
      values.isArchived = parsed.data.isArchived;
    if (parsed.data.actualHours !== undefined)
      values.actualHours = parsed.data.actualHours ?? null;
    if (parsed.data.categories !== undefined)
      values.categories = parsed.data.categories;
    if (parsed.data.pdfUrl !== undefined)
      values.pdfUrl = parsed.data.pdfUrl ?? null;
    if (parsed.data.pdfName !== undefined)
      values.pdfName = parsed.data.pdfName ?? null;

    await ref.update({ ...values, updatedAt: FieldValue.serverTimestamp() });

    const updated = await ref.get();

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${id}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapTask(updated) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const { ref } = await findUserTask(id);
    await ref.delete();

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function restoreTask(id: string): Promise<ActionResult<Task>> {
  try {
    const { ref } = await findUserTask(id);

    await ref.update({
      isArchived: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await ref.get();

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/tasks/archived");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapTask(updated) };
  } catch (error) {
    return toActionError(error);
  }
}
