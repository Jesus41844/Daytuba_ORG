"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { mapTask, toDateOrNull } from "@/db/mappers";
import { tasks } from "@/db/schema";
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

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  const row = rows[0];
  if (!row || row.userId !== session.uid) throw new NotFoundError("La tarea");

  return row;
}

async function getNextSortOrder(userId: string): Promise<number> {
  const rows = await db
    .select({ sortOrder: tasks.sortOrder })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.sortOrder))
    .limit(1);

  return (rows[0]?.sortOrder ?? -1) + 1;
}

export async function createTask(
  data: CreateTaskInput
): Promise<ActionResult<Task>> {
  try {
    const session = await requireSession();

    const parsed = createTaskSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const inserted = await db
      .insert(tasks)
      .values({
        userId: session.uid,
        projectId: parsed.data.projectId ?? null,
        parentId: parsed.data.parentId ?? null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: "pending",
        priority: parsed.data.priority,
        createdById: session.uid,
        createdByName: session.displayName,
        startDate: toDateOrNull(parsed.data.startDate ?? null),
        dueDate: toDateOrNull(parsed.data.dueDate ?? null),
        estimatedHours: parsed.data.estimatedHours ?? null,
        recurrence:
          parsed.data.recurrence === "none" ? null : parsed.data.recurrence,
        sortOrder: await getNextSortOrder(session.uid),
        categories: parsed.data.categories ?? [],
        source: "manual",
      })
      .returning();

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapTask(inserted[0]!) };
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

    await findUserTask(id);

    const values: Partial<typeof tasks.$inferInsert> = {};

    if (parsed.data.title !== undefined) values.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      values.description = parsed.data.description ?? null;
    if (parsed.data.projectId !== undefined)
      values.projectId = parsed.data.projectId ?? null;
    if (parsed.data.priority !== undefined)
      values.priority = parsed.data.priority;
    if (parsed.data.startDate !== undefined)
      values.startDate = toDateOrNull(parsed.data.startDate ?? null);
    if (parsed.data.dueDate !== undefined)
      values.dueDate = toDateOrNull(parsed.data.dueDate ?? null);
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
        parsed.data.status === "completed" ? new Date() : null;
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

    values.updatedAt = new Date();

    const updated = await db
      .update(tasks)
      .set(values)
      .where(eq(tasks.id, id))
      .returning();

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${id}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapTask(updated[0]!) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    await findUserTask(id);
    await db.delete(tasks).where(eq(tasks.id, id));

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
    await findUserTask(id);

    const updated = await db
      .update(tasks)
      .set({ isArchived: false, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/tasks/archived");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapTask(updated[0]!) };
  } catch (error) {
    return toActionError(error);
  }
}
