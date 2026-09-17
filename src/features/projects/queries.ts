import { and, asc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { mapProject } from "@/db/mappers";
import { projects } from "@/db/schema";
import type { Project } from "@/types";
import { requireSession } from "@/lib/auth/session";
import { getAccessibleProjectIds } from "@/lib/access";

export async function getUserProjects(): Promise<Project[]> {
  const session = await requireSession();
  const ids = await getAccessibleProjectIds(session);
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(projects)
    .where(inArray(projects.id, ids))
    .orderBy(asc(projects.sortOrder), asc(projects.createdAt));

  return rows.map(mapProject);
}

export async function getSharedProjects(): Promise<Project[]> {
  const session = await requireSession();
  const ids = await getAccessibleProjectIds(session);
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(projects)
    .where(and(inArray(projects.id, ids), ne(projects.userId, session.uid)))
    .orderBy(asc(projects.sortOrder), asc(projects.createdAt));

  return rows.map(mapProject);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const ids = await getAccessibleProjectIds(session);
  if (!ids.includes(row.id)) return null;
  return mapProject(row);
}