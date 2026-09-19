"use server";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  or,
  lt,
  lte,
  notInArray,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import { mapTask } from "@/db/mappers";
import { projectMembers, projects, tasks, users, workspaceMembers } from "@/db/schema";
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
  workspaceId?: string | null;
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
    eq(tasks.isArchived, false),
  ];

  if (filters?.workspaceId !== undefined) {
    const queuedIds = await getProjectIdsByWorkspace(
      session.uid,
      accessibleProjects,
      filters.workspaceId
    );

    if (queuedIds.length === 0 && filters.workspaceId !== null) {
      return [];
    }

    if (filters.workspaceId === null) {
      if (queuedIds.length > 0) {
        conditions.push(
          or(
            inArray(tasks.projectId, queuedIds),
            and(isNull(tasks.projectId), eq(tasks.userId, session.uid))
          )!
        );
      } else {
        conditions.push(
          and(isNull(tasks.projectId), eq(tasks.userId, session.uid))!
        );
      }
    } else if (queuedIds.length > 0) {
      conditions.push(inArray(tasks.projectId, queuedIds));
    }
  } else {
    conditions.push(buildTaskVisibility(session.uid, accessibleProjects));
  }

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

async function getProjectIdsByWorkspace(
  uid: string,
  accessibleIds: string[],
  workspaceId: string | null
): Promise<string[]> {
  if (accessibleIds.length === 0) return [];

  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        inArray(projects.id, accessibleIds),
        workspaceId === null
          ? isNull(projects.workspaceId)
          : eq(projects.workspaceId, workspaceId)
      )
    );

  return rows.map((row) => row.id);
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

/**
 * Cuenta de tareas accionables ya vencidas o que vencen hoy, para el badge
 * del ícono de la PWA (navigator.setAppBadge).
 *
 * Es la UNIÓN de las tarjetas "Vencidas" y "Para hoy" del dashboard, no su
 * suma: una tarea que vencía hoy más temprano cuenta en ambas tarjetas pero
 * una sola vez aquí.
 */
export async function getPendingBadgeCount(): Promise<number> {
  const session = await requireSession();
  const accessibleProjects = await getAccessibleProjectIds(session);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        buildTaskVisibility(session.uid, accessibleProjects),
        eq(tasks.isArchived, false),
        isNotNull(tasks.dueDate),
        lte(tasks.dueDate, endOfToday),
        notInArray(tasks.status, ["completed", "cancelled"])
      )
    );

  return rows.length;
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

const [ownerRows, memberRows, workspaceRows] = await Promise.all([
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
    db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        photoUrl: users.photoUrl,
      })
      .from(projects)
      .innerJoin(
        workspaceMembers,
        eq(workspaceMembers.workspaceId, projects.workspaceId!)
      )
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(projects.id, projectId)),
  ]);

  for (const row of [...ownerRows, ...memberRows, ...workspaceRows]) {
    result.set(row.id, { ...row, displayName: row.displayName || row.email });
  }

  return [...result.values()];
}