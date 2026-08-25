/**
 * Importa scripts/migration-data.json a PostgreSQL.
 *
 * Requisitos:
 *  - Los usuarios ya deben haberse re-registrado en la nueva app
 *    (el mapeo es por email, case-insensitive).
 *  - Idempotente: los documentos con ID existente se omiten.
 *
 * Uso: npx tsx --env-file=.env.local scripts/import-postgres.ts
 */
import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";

import { db, client } from "../src/db";
import {
  calendarEvents,
  categories,
  moodleCredentials,
  projects,
  scheduleBlocks,
  tasks,
  users,
} from "../src/db/schema";

type Row = Record<string, unknown>;

function toDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function bool(value: unknown): boolean {
  return value === true;
}

async function buildUidMap(data: Record<string, Row[]>): Promise<Map<string, string>> {
  const existing = await db.select({ id: users.id, email: users.email }).from(users);
  const byEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u.id]));

  const map = new Map<string, string>();
  let unmatched = 0;

  for (const doc of data.__auth_users ?? []) {
    const oldUid = str(doc.__id);
    const email = str(doc.email).toLowerCase();
    const newId = byEmail.get(email);
    if (email) {
      if (newId) {
        map.set(oldUid, newId);
      } else {
        unmatched++;
        console.warn(`  [!] sin cuenta nueva para ${email} (uid ${oldUid})`);
      }
    }
  }

  console.log(
    `usuarios mapeados: ${map.size}, sin cuenta nueva: ${unmatched}`
  );
  return map;
}

async function insertAll(
  label: string,
  docs: Row[] | undefined,
  uidMap: Map<string, string>,
  transform: (doc: Row, userId: string) => Promise<boolean> | boolean
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const doc of docs ?? []) {
    const userId = uidMap.get(str(doc.userId));
    if (!userId) {
      skipped++;
      continue;
    }
    try {
      const ok = await transform(doc, userId);
      if (ok) inserted++;
      else skipped++;
    } catch (error) {
      console.warn(`  [!] ${label}/${str(doc.__id)}: ${(error as Error).message}`);
      skipped++;
    }
  }

  console.log(`${label}: insertados ${inserted}, omitidos ${skipped}`);
  return { inserted, skipped };
}

async function main() {
  const data: Record<string, Row[]> = JSON.parse(
    readFileSync("scripts/migration-data.json", "utf8")
  );

  const uidMap = await buildUidMap(data);

  // --- projects ---
  await insertAll("projects", data.projects, uidMap, async (doc, userId) => {
    const result = await db
      .insert(projects)
      .values({
        id: str(doc.__id),
        userId,
        name: str(doc.name),
        description: nullableStr(doc.description),
        icon: str(doc.icon),
        color: str(doc.color),
        sortOrder: num(doc.sortOrder) ?? 0,
        isDefault: bool(doc.isDefault),
        moodleCourseId: nullableStr(doc.moodleCourseId),
        moodlePlatform: nullableStr(doc.moodlePlatform) as never,
        moodleUrl: nullableStr(doc.moodleUrl),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      })
      .onConflictDoNothing({ target: projects.id })
      .returning({ id: projects.id });
    return result.length > 0;
  });

  // --- categories ---
  await insertAll("categories", data.categories, uidMap, async (doc, userId) => {
    const result = await db
      .insert(categories)
      .values({
        id: str(doc.__id),
        userId,
        name: str(doc.name),
        color: str(doc.color),
        createdAt: toDate(doc.createdAt) ?? new Date(),
      })
      .onConflictDoNothing({ target: categories.id })
      .returning({ id: categories.id });
    return result.length > 0;
  });

  // --- tasks ---
  await insertAll("tasks", data.tasks, uidMap, async (doc, userId) => {
    const projectId = nullableStr(doc.projectId);
    let resolvedProject: string | null = projectId;
    if (projectId) {
      // verificar que el proyecto existe y pertenece al mismo usuario
      const exists = await db
        .select({ id: projects.id })
        .from(projects)
        .where(sql`${projects.id} = ${projectId} and ${projects.userId} = ${userId}`)
        .limit(1);
      if (exists.length === 0) resolvedProject = null;
    }

    const parentId = nullableStr(doc.parentId);

    const result = await db
      .insert(tasks)
      .values({
        id: str(doc.__id),
        userId,
        projectId: resolvedProject,
        parentId,
        title: str(doc.title),
        description: nullableStr(doc.description),
        status: str(doc.status, "pending") as never,
        priority: str(doc.priority, "medium") as never,
        createdById: str(doc.createdById),
        createdByName: str(doc.createdByName),
        startDate: toDate(doc.startDate),
        dueDate: toDate(doc.dueDate),
        estimatedHours: num(doc.estimatedHours),
        actualHours: num(doc.actualHours),
        completedAt: toDate(doc.completedAt),
        recurrence: nullableStr(doc.recurrence) as never,
        isArchived: bool(doc.isArchived),
        sortOrder: num(doc.sortOrder) ?? 0,
        categories: strArray(doc.categories),
        pdfUrl: nullableStr(doc.pdfUrl),
        pdfName: nullableStr(doc.pdfName),
        source: str(doc.source, "manual") as never,
        moodlePlatform: nullableStr(doc.moodlePlatform) as never,
        moodleCourseId: nullableStr(doc.moodleCourseId),
        moodleAssignmentId: nullableStr(doc.moodleAssignmentId),
        moodleUrl: nullableStr(doc.moodleUrl),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      })
      .onConflictDoNothing({ target: tasks.id })
      .returning({ id: tasks.id });
    return result.length > 0;
  });

  // --- calendar_events ---
  await insertAll("calendar_events", data.calendar_events, uidMap, async (doc, userId) => {
    const result = await db
      .insert(calendarEvents)
      .values({
        id: str(doc.__id),
        userId,
        title: str(doc.title),
        startTime: str(doc.startTime, "09:00"),
        endTime: str(doc.endTime, "10:00"),
        color: str(doc.color, "#0b57d0"),
        date: nullableStr(doc.date),
        dayOfWeek: num(doc.dayOfWeek),
        createdAt: toDate(doc.createdAt) ?? new Date(),
      })
      .onConflictDoNothing({ target: calendarEvents.id })
      .returning({ id: calendarEvents.id });
    return result.length > 0;
  });

  // --- schedule_blocks ---
  await insertAll("schedule_blocks", data.schedule_blocks, uidMap, async (doc, userId) => {
    const result = await db
      .insert(scheduleBlocks)
      .values({
        id: str(doc.__id),
        userId,
        name: str(doc.name),
        dayOfWeek: num(doc.dayOfWeek) ?? 0,
        startTime: str(doc.startTime),
        endTime: str(doc.endTime),
        color: str(doc.color, "#0b57d0"),
        pdfUrl: nullableStr(doc.pdfUrl),
        pdfName: nullableStr(doc.pdfName),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      })
      .onConflictDoNothing({ target: scheduleBlocks.id })
      .returning({ id: scheduleBlocks.id });
    return result.length > 0;
  });

  // --- moodle_credentials ---
  await insertAll("moodle_credentials", data.moodle_credentials, uidMap, async (doc, userId) => {
    const result = await db
      .insert(moodleCredentials)
      .values({
        id: str(doc.__id),
        userId,
        platform: str(doc.platform, "ecampus") as never,
        username: str(doc.username),
        encryptedPassword: str(doc.encryptedPassword),
        iv: str(doc.iv),
        tag: str(doc.tag),
        lastSyncAt: toDate(doc.lastSyncAt),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      })
      .onConflictDoNothing({ target: moodleCredentials.id })
      .returning({ id: moodleCredentials.id });
    return result.length > 0;
  });

  console.log("\nImportación finalizada");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
