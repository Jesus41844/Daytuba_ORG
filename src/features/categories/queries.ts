"use server";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { mapCategory } from "@/db/mappers";
import { categories, tasks } from "@/db/schema";
import type { Category } from "@/types";
import { requireSession } from "@/lib/auth/session";
import { canAccessTask } from "@/lib/access";
import { NotFoundError } from "@/lib/errors";

export async function getUserCategories(): Promise<Category[]> {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, session.uid))
    .orderBy(asc(categories.name));

  return rows.map(mapCategory);
}

export async function getTaskCategories(taskId: string): Promise<Category[]> {
  const session = await requireSession();

  const taskRows = await db
    .select({ userId: tasks.userId, projectId: tasks.projectId, categories: tasks.categories })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  const task = taskRows[0];
  if (!task) throw new NotFoundError("La tarea");
  if (!(await canAccessTask(task, session))) throw new NotFoundError("La tarea");

  const categoryIds = (task.categories ?? []).filter(
    (id) => typeof id === "string"
  );
  if (categoryIds.length === 0) return [];

  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, session.uid));

  return rows
    .filter((row) => categoryIds.includes(row.id))
    .map(mapCategory)
    .sort((a, b) => a.name.localeCompare(b.name));
}
