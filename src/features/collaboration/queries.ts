"use server";

import { and, asc, eq, ilike, notInArray, or } from "drizzle-orm";

import { db } from "@/db";
import { projectMembers, projects, users } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { requireProjectAccess } from "@/lib/access";
import type { ProjectMemberRole } from "@/types";

export type ProjectMemberProfile = {
  userId: string;
  email: string;
  displayName: string;
  role: ProjectMemberRole | "owner";
  joinedAt: Date;
};

export type UserSearchResult = {
  id: string;
  email: string;
  displayName: string;
};

export async function getProjectMembers(
  projectId: string
): Promise<ProjectMemberProfile[]> {
  await requireProjectAccess(projectId);

  const [ownerRows, memberRows] = await Promise.all([
    db
      .select({
        userId: projects.userId,
        email: users.email,
        displayName: users.displayName,
        joinedAt: projects.createdAt,
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.userId))
      .where(eq(projects.id, projectId))
      .limit(1),
    db
      .select({
        userId: projectMembers.userId,
        email: users.email,
        displayName: users.displayName,
        role: projectMembers.role,
        joinedAt: projectMembers.createdAt,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(asc(projectMembers.createdAt)),
  ]);

  const owner = ownerRows[0];
  const members: ProjectMemberProfile[] = memberRows.map((row) => ({
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    role: row.role as ProjectMemberRole,
    joinedAt: row.joinedAt,
  }));

  if (owner && !members.some((m) => m.userId === owner.userId)) {
    members.unshift({
      userId: owner.userId,
      email: owner.email,
      displayName: owner.displayName,
      role: "owner" as const,
      joinedAt: owner.joinedAt,
    });
  }

  return members;
}

export async function searchUsers(
  term: string,
  projectId?: string
): Promise<UserSearchResult[]> {
  const session = await requireSession();
  const query = term.trim();

  const excludedIds = [session.uid];

  if (projectId) {
    await requireProjectAccess(projectId);

    const [ownerRows, memberRows] = await Promise.all([
      db
        .select({ userId: projects.userId })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1),
      db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, projectId)),
    ]);

    if (ownerRows[0]) excludedIds.push(ownerRows[0].userId);
    excludedIds.push(...memberRows.map((row) => row.userId));
  }

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