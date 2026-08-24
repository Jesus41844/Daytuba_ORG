"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/db/server";
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

export async function createCategory(
  data: CreateCategoryInput
): Promise<ActionResult<Category>> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const parsed = createCategorySchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const existing = await db
      .collection("categories")
      .where("userId", "==", session.uid)
      .where("name", "==", parsed.data.name)
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new ConflictError("Ya existe una categoría con ese nombre");
    }

    const categoryRef = db.collection("categories").doc();

    const category: Category = {
      id: categoryRef.id,
      userId: session.uid,
      name: parsed.data.name,
      color: parsed.data.color ?? "#6b7280",
      createdAt: new Date().toISOString(),
    };

    await categoryRef.set({ ...category, createdAt: FieldValue.serverTimestamp() });

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
    const session = await requireSession();
    const db = await getDb();

    const snapshot = await db.collection("categories").doc(id).get();
    if (!snapshot.exists) throw new NotFoundError("La categoría");
    if (snapshot.get("userId") !== session.uid) throw new NotFoundError("La categoría");

    const parsed = createCategorySchema.partial().safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const values: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) values.name = parsed.data.name;
    if (parsed.data.color !== undefined) values.color = parsed.data.color;

    await snapshot.ref.update({
      ...values,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await snapshot.ref.get();

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: { id: updated.id, ...updated.data() } as Category };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const snapshot = await db.collection("categories").doc(id).get();
    if (!snapshot.exists) throw new NotFoundError("La categoría");
    if (snapshot.get("userId") !== session.uid) throw new NotFoundError("La categoría");

    const tasksWithCategory = await db
      .collection("tasks")
      .where("userId", "==", session.uid)
      .where("categories", "array-contains", id)
      .get();

    const batch = db.batch();
    for (const task of tasksWithCategory.docs) {
      batch.update(task.ref, {
        categories: FieldValue.arrayRemove(id),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    batch.delete(snapshot.ref);
    await batch.commit();

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
    const db = await getDb();

    const taskSnapshot = await db.collection("tasks").doc(taskId).get();
    if (!taskSnapshot.exists) throw new NotFoundError("La tarea");
    if (taskSnapshot.get("userId") !== session.uid) throw new NotFoundError("La tarea");

    const categorySnapshot = await db.collection("categories").doc(categoryId).get();
    if (!categorySnapshot.exists) throw new NotFoundError("La categoría");
    if (categorySnapshot.get("userId") !== session.uid) throw new NotFoundError("La categoría");

    await taskSnapshot.ref.update({
      categories: FieldValue.arrayUnion(categoryId),
      updatedAt: FieldValue.serverTimestamp(),
    });

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
    const db = await getDb();

    const taskSnapshot = await db.collection("tasks").doc(taskId).get();
    if (!taskSnapshot.exists) throw new NotFoundError("La tarea");
    if (taskSnapshot.get("userId") !== session.uid) throw new NotFoundError("La tarea");

    await taskSnapshot.ref.update({
      categories: FieldValue.arrayRemove(categoryId),
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${taskId}`);
    revalidatePath("/dashboard/inbox");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
