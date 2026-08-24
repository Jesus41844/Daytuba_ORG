"use server";

import { getDb } from "@/lib/db/server";
import { mapTask } from "@/lib/firebase/mappers";
import type { Task } from "@/types";
import { requireSession } from "@/lib/auth/session";

export type InboxTask = Task;

const PRIORITY_RANK: Record<Task["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function getInbox(): Promise<InboxTask[]> {
  const session = await requireSession();
  const db = await getDb();

  const snapshot = await db
    .collection("tasks")
    .where("userId", "==", session.uid)
    .where("isArchived", "==", false)
    .get();

  const tasks = snapshot.docs
    .map(mapTask)
    .filter(
      (task) => task.status !== "completed" && task.status !== "cancelled"
    );

  tasks.sort((a, b) => {
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rankDiff !== 0) return rankDiff;
    return a.createdAt > b.createdAt ? -1 : 1;
  });

  return tasks;
}
