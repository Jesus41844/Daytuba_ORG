"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { mapTask } from "@/db/mappers";
import { tasks } from "@/db/schema";
import type { Task } from "@/types";
import { requireSession } from "@/lib/auth/session";
import { buildTaskVisibility, getAccessibleProjectIds } from "@/lib/access";

export type InboxTask = Task;

const PRIORITY_RANK: Record<Task["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function getInbox(): Promise<InboxTask[]> {
  const session = await requireSession();
  const accessibleProjects = await getAccessibleProjectIds(session);

  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        buildTaskVisibility(session.uid, accessibleProjects),
        eq(tasks.isArchived, false)
      )
    );

  const inboxTasks = rows.map(mapTask).filter(
    (task) => task.status !== "completed" && task.status !== "cancelled"
  );

  inboxTasks.sort((a, b) => {
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rankDiff !== 0) return rankDiff;
    return a.createdAt > b.createdAt ? -1 : 1;
  });

  return inboxTasks;
}
