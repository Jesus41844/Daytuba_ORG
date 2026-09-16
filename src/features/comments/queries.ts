"use server";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { taskComments, tasks, users } from "@/db/schema";
import type { TaskComment } from "@/types";
import { requireTaskAccess } from "@/lib/access";
import { NotFoundError } from "@/lib/errors";

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const taskRows = await db
    .select({ userId: tasks.userId, projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  const task = taskRows[0];
  if (!task) throw new NotFoundError("La tarea");
  await requireTaskAccess(task);

  const rows = await db
    .select({
      id: taskComments.id,
      taskId: taskComments.taskId,
      userId: taskComments.userId,
      body: taskComments.body,
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt,
      authorName: users.displayName,
      authorEmail: users.email,
    })
    .from(taskComments)
    .innerJoin(users, eq(users.id, taskComments.userId))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt));

  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    userId: row.userId,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}