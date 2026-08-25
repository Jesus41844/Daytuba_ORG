"use server";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { mapProject } from "@/db/mappers";
import { projects } from "@/db/schema";
import type { Project } from "@/types";
import { requireSession } from "@/lib/auth/session";

export async function getUserProjects(): Promise<Project[]> {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, session.uid))
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
  if (!row || row.userId !== session.uid) return null;
  return mapProject(row);
}
