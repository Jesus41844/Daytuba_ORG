"use server";

import { and, asc, eq, ilike, notInArray, or } from "drizzle-orm";

import { db } from "@/db";
import { mapWorkspace } from "@/db/mappers";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { requireWorkspaceAccess } from "@/lib/access";
import type { Workspace, WorkspaceMember, WorkspaceRole } from "@/types";

export type WorkspaceWithRole = {
  workspace: Workspace;
  role: WorkspaceRole;
};

export type UserSearchResult = {
  id: string;
  email: string;
  displayName: string;
};

export async function getUserWorkspaces(): Promise<WorkspaceWithRole[]> {
  const session = await requireSession();

  const rows = await db
    .select({
      workspace: workspaces,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(
      workspaces,
      eq(workspaces.id, workspaceMembers.workspaceId)
    )
    .where(eq(workspaceMembers.userId, session.uid))
    .orderBy(asc(workspaces.createdAt));

  return rows.map((row) => ({
    workspace: mapWorkspace(row.workspace),
    role: row.role as WorkspaceRole,
  }));
}

export async function getWorkspaceById(
  workspaceId: string
): Promise<Workspace | null> {
  await requireWorkspaceAccess(workspaceId);

  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const row = rows[0];
  return row ? mapWorkspace(row) : null;
}

export async function getWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMember[]> {
  await requireWorkspaceAccess(workspaceId);

  const rows = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      email: users.email,
      displayName: users.displayName,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(workspaceMembers.createdAt));

  return rows.map((row) => ({
    workspaceId: row.workspaceId,
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    role: row.role as WorkspaceRole,
    joinedAt: row.joinedAt,
  }));
}

export async function searchWorkspaceInviteUsers(
  term: string,
  workspaceId: string
): Promise<UserSearchResult[]> {
  const session = await requireSession();
  await requireWorkspaceAccess(workspaceId);

  const query = term.trim();

  const memberRows = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  const excludedIds = [session.uid, ...memberRows.map((row) => row.userId)];

  const searchCondition = query
    ? or(
        ilike(users.email, `%${query}%`),
        ilike(users.displayName, `%${query}%`)
      )
    : undefined;

  const rows = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(and(notInArray(users.id, excludedIds), searchCondition))
    .orderBy(asc(users.email))
    .limit(10);

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.displayName,
  }));
}