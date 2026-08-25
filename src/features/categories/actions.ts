"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { mapCategory } from "@/db/mappers";
import { categories, tasks } from "@/db/schema";
import type { Category } from "@/types";
import { requireSession } from "@/lib/auth/session";
import {
  type ActionResult,
  AppError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { createCategorySchema, type CreateCategoryInput } from "@/lib/validations";

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

async function findUserCategory(id: string) {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  const row = rows[0];
  if (!row || row.userId !== session.uid)
    throw new NotFoundError("La categoría");

  return row;
}

export async function createCategory(
  data: CreateCategoryInput
): Promise<ActionResult<Category>> {
  try {
    const session = await requireSession();

    const parsed = createCategorySchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.userId, session.uid),
          eq(categories.name, parsed.data.name)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError("Ya existe una categoría con ese nombre");
    }

    const inserted = await db
      .insert(categories)
      .values({
        userId: session.uid,
        name: parsed.data.name,
        color: parsed.data.color ?? "#6b7280",
      })
      .returning();

    const category = mapCategory(inserted[0]!);

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: category };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateCategory(
  id: string,
  data: Partial<CreateCategoryInput>
): Promise<ActionResult<Category>> {
  try {
    const existing = await findUserCategory(id);

    const parsed = createCategorySchema.partial().safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const updated = await db
      .update(categories)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.color !== undefined && { color: parsed.data.color }),
      })
      .where(eq(categories.id, existing.id))
      .returning();

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapCategory(updated[0]!) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const existing = await findUserCategory(id);

    await db.transaction(async (tx) => {
      await tx
        .update(tasks)
        .set({
          categories: sql`array_remove(categories, ${id})`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.userId, existing.userId),
            sql`${id} = ANY(categories)`
          )
        );
      await tx.delete(categories).where(eq(categories.id, id));
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function addCategoryToTask(
  taskId: string,
  categoryId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const taskRows = await db
      .select({ userId: tasks.userId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!taskRows[0] || taskRows[0].userId !== session.uid)
      throw new NotFoundError("La tarea");

    const categoryRows = await db
      .select({ userId: categories.userId })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    if (!categoryRows[0] || categoryRows[0].userId !== session.uid)
      throw new NotFoundError("La categoría");

    await db
      .update(tasks)
      .set({
        categories: sql`array_append(${tasks.categories}, ${categoryId})`,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);
    revalidatePath("/dashboard/inbox");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeCategoryFromTask(
  taskId: string,
  categoryId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const taskRows = await db
      .select({ userId: tasks.userId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!taskRows[0] || taskRows[0].userId !== session.uid)
      throw new NotFoundError("La tarea");

    await db
      .update(tasks)
      .set({
        categories: sql`array_remove(${tasks.categories}, ${categoryId})`,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);
    revalidatePath("/dashboard/inbox");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
