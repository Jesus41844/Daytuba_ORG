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
} from "drizzle-orm";

import { db } from "@/db";
import { mapTask } from "@/db/mappers";
import { projectMembers, projects, tasks, users } from "@/db/schema";
import type { Task } from "@/types";
import { requireSession } from "@/lib/auth/session";
import {
  buildTaskVisibility,
  canAccessTask,
  getAccessibleProjectIds,
  getProjectAccess,
} from "@/lib/access";

export type TaskFilters = {
  projectId?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  categoryId?: string;
  assigneeId?: string;
};

export type AssignableUser = {
  id: string;
  displayName: string;
  email: string;
  photoUrl: string | null;
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
  if (filters?.assigneeId) {
    conditions.push(eq(tasks.assigneeId, filters.assigneeId));
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

export async function getAssignableUsers(
  projectId?: string | null
): Promise<AssignableUser[]> {
  const session = await requireSession();

  const result = new Map<string, AssignableUser>();
  result.set(session.uid, {
    id: session.uid,
    displayName: session.displayName || session.email,
    email: session.email,
    photoUrl: session.photoUrl,
  });

  if (!projectId) return [...result.values()];

  const access = await getProjectAccess(projectId, session);
  if (!access) return [...result.values()];

  const [ownerRows, memberRows] = await Promise.all([
    db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        photoUrl: users.photoUrl,
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.userId))
      .where(eq(projects.id, projectId))
      .limit(1),
    db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        photoUrl: users.photoUrl,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId)),
  ]);

  for (const row of ownerRows) {
    result.set(row.id, { ...row, displayName: row.displayName || row.email });
  }
  for (const row of memberRows) {
    result.set(row.id, { ...row, displayName: row.displayName || row.email });
  }

  return [...result.values()];
}