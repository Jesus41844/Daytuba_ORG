"use server";

import { getDb } from "@/lib/db/server";
import { mapCategory } from "@/lib/firebase/mappers";
import type { Category } from "@/types";
import { requireSession } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";

export async function getUserCategories(): Promise<Category[]> {
  const session = await requireSession();
  const db = await getDb();

  const snapshot = await db
    .collection("categories")
    .where("userId", "==", session.uid)
    .orderBy("name", "asc")
    .get();
  return snapshot.docs.map(mapCategory);
}

export async function getTaskCategories(taskId: string): Promise<Category[]> {
  const session = await requireSession();
  const db = await getDb();

  const taskSnapshot = await db.collection("tasks").doc(taskId).get();
  if (!taskSnapshot.exists) throw new NotFoundError("La tarea");
  if (taskSnapshot.get("userId") !== session.uid) throw new NotFoundError("La tarea");

  const rawCategories = taskSnapshot.get("categories");
  const categoryIds = Array.isArray(rawCategories)
    ? rawCategories.filter((id): id is string => typeof id === "string")
    : [];

  if (categoryIds.length === 0) return [];

  const snapshots = await Promise.all(
    categoryIds.map(async (id) => db.collection("categories").doc(id).get())
  );

  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map(mapCategory)
    .sort((a, b) => a.name.localeCompare(b.name));
}
