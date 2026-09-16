import { and, eq, inArray, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { db } from "@/db";
import { projects, projectMembers, tasks } from "@/db/schema";
import { requireSession, type AuthUser } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { ProjectMemberRole } from "@/types";

export type ProjectAccess = {
  role: "owner" | ProjectMemberRole;
  readWrite: boolean;
};

export async function getAccessibleProjectIds(
  session: AuthUser
): Promise<string[]> {
  if (!session) return [];

  const [owned, memberships] = await Promise.all([
    db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.userId, session.uid)),
    db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, session.uid)),
  ]);

  const ids = new Set<string>();
  for (const row of owned) ids.add(row.id);
  for (const row of memberships) ids.add(row.projectId);
  return [...ids];
}

export async function getProjectAccess(
  projectId: string,
  session: AuthUser
): Promise<ProjectAccess | null> {
  const project = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const row = project[0];
  if (!row) return null;

  if (row.userId === session.uid) {
    return { role: "owner", readWrite: true };
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
  const access = await getProjectAccess(projectId, session);
  if (!access) throw new NotFoundError("El proyecto");
  if (access.role !== "owner") {
    throw new ForbiddenError("Solo el propietario puede hacer esta acción");
  }
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