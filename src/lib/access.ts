import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  projects,
  projectMembers,
  tasks,
  workspaceMembers,
} from "@/db/schema";
import { requireSession, type AuthUser } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { ProjectMemberRole, WorkspaceRole } from "@/types";

export type ProjectAccess = {
  role: "owner" | ProjectMemberRole;
  readWrite: boolean;
};

export type WorkspaceAccess = {
  role: WorkspaceRole;
  readWrite: boolean;
};

export async function getWorkspaceRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);

  return rows[0]?.role ?? null;
}

export async function getAccessibleProjectIds(
  session: AuthUser
): Promise<string[]> {
  if (!session) return [];

  const [owned, memberships, wsMemberships] = await Promise.all([
    db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.userId, session.uid)),
    db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, session.uid)),
    db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, session.uid)),
  ]);

  const ids = new Set<string>();
  for (const row of owned) ids.add(row.id);
  for (const row of memberships) ids.add(row.projectId);

  if (wsMemberships.length > 0) {
    const workspaceIds = wsMemberships.map((row) => row.workspaceId);
    const wsProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          inArray(projects.workspaceId, workspaceIds),
          isNotNull(projects.workspaceId)
        )
      );
    for (const row of wsProjects) ids.add(row.id);
  }

  return [...ids];
}

export async function getProjectAccess(
  projectId: string,
  session: AuthUser
): Promise<ProjectAccess | null> {
  const project = await db
    .select({ userId: projects.userId, workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const row = project[0];
  if (!row) return null;

  if (row.userId === session.uid) {
    return { role: "owner", readWrite: true };
  }

  if (row.workspaceId) {
    const wsRole = await getWorkspaceRole(row.workspaceId, session.uid);
    if (wsRole) {
      return {
        role: wsRole === "viewer" ? "viewer" : "editor",
        readWrite: wsRole !== "viewer",
      };
    }
  }

  const member = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, session.uid)
      )
    )
    .limit(1);

  const role = member[0]?.role;
  if (!role) return null;
  return { role, readWrite: role === "editor" };
}

export async function requireWorkspaceAccess(
  workspaceId: string,
  opts: { write?: boolean } = {}
): Promise<WorkspaceAccess> {
  const session = await requireSession();
  const role = await getWorkspaceRole(workspaceId, session.uid);
  if (!role) throw new NotFoundError("El espacio de trabajo");

  const readWrite = role !== "viewer";
  if (opts.write && !readWrite) {
    throw new ForbiddenError(
      "No tienes permisos de edición en este espacio de trabajo"
    );
  }
  return { role, readWrite };
}

export async function requireWorkspaceAdmin(
  workspaceId: string
): Promise<void> {
  await requireWorkspaceAccess(workspaceId);
  const session = await requireSession();
  const role = await getWorkspaceRole(workspaceId, session.uid);
  if (role !== "admin") {
    throw new ForbiddenError(
      "Solo los administradores pueden hacer esta acción"
    );
  }
}

export async function requireProjectAccess(
  projectId: string,
  opts: { write?: boolean } = {}
): Promise<ProjectAccess> {
  const session = await requireSession();
  const access = await getProjectAccess(projectId, session);
  if (!access) throw new NotFoundError("El proyecto");
  if (opts.write && !access.readWrite) {
    throw new ForbiddenError("No tienes permisos de edición en este proyecto");
  }
  return access;
}

export async function requireProjectOwner(
  projectId: string
): Promise<void> {
  const session = await requireSession();
  const project = await db
    .select({ userId: projects.userId, workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const row = project[0];
  if (!row) throw new NotFoundError("El proyecto");

  if (row.userId === session.uid) return;

  if (row.workspaceId) {
    const wsRole = await getWorkspaceRole(row.workspaceId, session.uid);
    if (wsRole === "admin" || wsRole === "member") return;
    throw new ForbiddenError("No tienes permisos para gestionar este proyecto");
  }

  throw new ForbiddenError("Solo el propietario puede hacer esta acción");
}

export async function canAccessTask(
  task: { userId: string; projectId: string | null },
  session: AuthUser
): Promise<boolean> {
  if (task.userId === session.uid) return true;
  if (!task.projectId) return false;
  const access = await getProjectAccess(task.projectId, session);
  return access !== null;
}

export async function requireTaskAccess(
  row: { userId: string; projectId: string | null },
  opts: { write?: boolean } = {}
): Promise<ProjectAccess | null> {
  const session = await requireSession();
  if (row.userId === session.uid) return { role: "owner", readWrite: true };
  if (!row.projectId) throw new NotFoundError("La tarea");
  const access = await getProjectAccess(row.projectId, session);
  if (!access) throw new NotFoundError("La tarea");
  if (opts.write && !access.readWrite) {
    throw new ForbiddenError("No tienes permisos de edición en esta tarea");
  }
  return access;
}

export function buildTaskVisibility(
  uid: string,
  projectIds: string[]
): SQL {
  return projectIds.length > 0
    ? or(eq(tasks.userId, uid), inArray(tasks.projectId, projectIds))!
    : eq(tasks.userId, uid);
}