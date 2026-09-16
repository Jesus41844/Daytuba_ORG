"use server";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  or,
  lt,
  notInArray,
  isNotNull,
} from "drizzle-orm";

import { db } from "@/db";
import { mapTask } from "@/db/mappers";
import { tasks } from "@/db/schema";
import type { Task } from "@/types";
import { requireSession } from "@/lib/auth/session";
import {
  buildTaskVisibility,
  canAccessTask,
  getAccessibleProjectIds,
} from "@/lib/access";

const REMINDER_WINDOW_MS = 10 * 60 * 1000;

export type TaskFilters = {
  projectId?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  categoryId?: string;
};

export async function getUserTasks(
  filters?: TaskFilters
): Promise<Task[]> {
  const session = await requireSession();
  const accessibleProjects = await getAccessibleProjectIds(session);

  const conditions = [
    buildTaskVisibility(session.uid, accessibleProjects),
    eq(tasks.isArchived, false),
  ];

  if (filters?.projectId) {
    conditions.push(eq(tasks.projectId, filters.projectId));
  }
  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters?.priority) {
    conditions.push(eq(tasks.priority, filters.priority));
  }

  let rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt));

  if (filters?.categoryId) {
    rows = rows.filter((t) => t.categories.includes(filters.categoryId!));
  }

  return rows.map(mapTask);
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!(await canAccessTask(row, session))) return null;
  return mapTask(row);
}

export async function getOverdueTasks(): Promise<Task[]> {
  const session = await requireSession();
  const now = new Date();
  const accessibleProjects = await getAccessibleProjectIds(session);

  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        buildTaskVisibility(session.uid, accessibleProjects),
        eq(tasks.isArchived, false),
        lt(tasks.dueDate, now),
        notInArray(tasks.status, ["completed", "cancelled"])
      )
    )
    .orderBy(asc(tasks.dueDate));

  return rows.map(mapTask);
}

export async function getArchivedTasks(): Promise<Task[]> {
  const session = await requireSession();
  const accessibleProjects = await getAccessibleProjectIds(session);

  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        buildTaskVisibility(session.uid, accessibleProjects),
        eq(tasks.isArchived, true)
      )
    )
    .orderBy(desc(tasks.updatedAt));

  return rows.map(mapTask);
}

export async function getTasksForCalendar(): Promise<Task[]> {
  const session = await requireSession();
  const accessibleProjects = await getAccessibleProjectIds(session);

  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        buildTaskVisibility(session.uid, accessibleProjects),
        eq(tasks.isArchived, false),
        gt(tasks.dueDate, new Date(0))
      )
    );

  return rows
    .map(mapTask)
    .filter((task) => task.dueDate != null)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

export async function getTasksWithReminders(): Promise<Task[]> {
  const session = await requireSession();
  const accessibleProjects = await getAccessibleProjectIds(session);

  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        buildTaskVisibility(session.uid, accessibleProjects),
        eq(tasks.isArchived, false),
        isNotNull(tasks.reminderAt),
        gt(tasks.reminderAt, new Date(Date.now() - REMINDER_WINDOW_MS)),
        notInArray(tasks.status, ["completed", "cancelled"])
      )
    )
    .orderBy(asc(tasks.reminderAt));

  return rows.map(mapTask);
}

export async function searchTasks(query: string): Promise<Task[]> {
  const session = await requireSession();
  const term = query.trim();
  if (!term) return [];

  const pattern = `%${term}%`;
  const accessibleProjects = await getAccessibleProjectIds(session);

  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        buildTaskVisibility(session.uid, accessibleProjects),
        eq(tasks.isArchived, false),
        or(ilike(tasks.title, pattern), ilike(tasks.description, pattern))
      )
    )
    .limit(15)
    .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt));

  return rows.map(mapTask);
}