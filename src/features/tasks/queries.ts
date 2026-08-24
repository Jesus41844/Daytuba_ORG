"use server";

import type { Query } from "firebase-admin/firestore";
import { getDb } from "@/lib/db/server";
import { mapTask } from "@/lib/firebase/mappers";
import type { Task } from "@/types";
import { requireSession } from "@/lib/auth/session";

export type TaskFilters = {
  projectId?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  categoryId?: string;
};

export async function getUserTasks(
  filters?: TaskFilters
): Promise<Task[]> {
  const session = await requireSession();
  const db = await getDb();

  let tasksQuery: Query = db
    .collection("tasks")
    .where("userId", "==", session.uid)
    .where("isArchived", "==", false);

  if (filters?.projectId) {
    tasksQuery = tasksQuery.where("projectId", "==", filters.projectId);
  }
  if (filters?.status) {
    tasksQuery = tasksQuery.where("status", "==", filters.status);
  }
  if (filters?.priority) {
    tasksQuery = tasksQuery.where("priority", "==", filters.priority);
  }

  tasksQuery = tasksQuery
    .orderBy("sortOrder", "asc")
    .orderBy("createdAt", "desc");

  const snapshot = await tasksQuery.get();
  let tasks = snapshot.docs.map(mapTask);

  if (filters?.categoryId) {
    tasks = tasks.filter((t) => t.categories.includes(filters.categoryId!));
  }

  return tasks;
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const session = await requireSession();
  const db = await getDb();

  const snapshot = await db.collection("tasks").doc(taskId).get();
  if (!snapshot.exists) return null;
  if (snapshot.get("userId") !== session.uid) return null;
  return mapTask(snapshot);
}

export async function getOverdueTasks(): Promise<Task[]> {
  const session = await requireSession();
  const db = await getDb();

  const now = new Date().toISOString();

  const snapshot = await db
    .collection("tasks")
    .where("userId", "==", session.uid)
    .where("isArchived", "==", false)
    .where("dueDate", "<", now)
    .where("status", "not-in", ["completed", "cancelled"])
    .orderBy("dueDate", "asc")
    .get();
  return snapshot.docs.map(mapTask);
}

export async function getArchivedTasks(): Promise<Task[]> {
  const session = await requireSession();
  const db = await getDb();

  const snapshot = await db
    .collection("tasks")
    .where("userId", "==", session.uid)
    .where("isArchived", "==", true)
    .orderBy("updatedAt", "desc")
    .get();
  return snapshot.docs.map(mapTask);
}

export async function getTasksForCalendar(): Promise<Task[]> {
  const session = await requireSession();
  const db = await getDb();

  const snapshot = await db
    .collection("tasks")
    .where("userId", "==", session.uid)
    .where("isArchived", "==", false)
    .get();
  return snapshot.docs
    .map(mapTask)
    .filter((task) => task.dueDate != null)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}
