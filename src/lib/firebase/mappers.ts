import {
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import type { Category, Project, Task, TaskPriority, TaskStatus, TaskSource, MoodlePlatform } from "@/types";

type SnapshotLike =
  | DocumentSnapshot<DocumentData>
  | QueryDocumentSnapshot<DocumentData>;

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function mapTask(snapshot: SnapshotLike): Task {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    userId: toStringValue(data.userId),
    projectId: toNullableString(data.projectId),
    parentId: toNullableString(data.parentId),
    title: toStringValue(data.title),
    description: toNullableString(data.description),
    status: toStringValue(data.status, "pending") as TaskStatus,
    priority: toStringValue(data.priority, "medium") as TaskPriority,
    createdById: toStringValue(data.createdById),
    createdByName: toStringValue(data.createdByName),
    startDate: toNullableString(data.startDate),
    dueDate: toNullableString(data.dueDate),
    estimatedHours: toNullableNumber(data.estimatedHours),
    actualHours: toNullableNumber(data.actualHours),
    completedAt: toNullableString(data.completedAt),
    recurrence: toNullableString(data.recurrence) as Task["recurrence"],
    isArchived: data.isArchived === true,
    sortOrder: toNumber(data.sortOrder),
    categories: toStringArray(data.categories),
    pdfUrl: toNullableString(data.pdfUrl),
    pdfName: toNullableString(data.pdfName),
    source: (toStringValue(data.source, "manual") as TaskSource),
    moodlePlatform: toNullableString(data.moodlePlatform) as MoodlePlatform | null,
    moodleCourseId: toNullableString(data.moodleCourseId),
    moodleAssignmentId: toNullableString(data.moodleAssignmentId),
    moodleUrl: toNullableString(data.moodleUrl),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export function mapProject(snapshot: SnapshotLike): Project {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    userId: toStringValue(data.userId),
    name: toStringValue(data.name),
    description: toNullableString(data.description),
    icon: toStringValue(data.icon),
    color: toStringValue(data.color),
    sortOrder: toNumber(data.sortOrder),
    isDefault: data.isDefault === true,
    moodleCourseId: toNullableString(data.moodleCourseId),
    moodlePlatform: toNullableString(data.moodlePlatform) as MoodlePlatform | null,
    moodleUrl: toNullableString(data.moodleUrl),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export function mapCategory(snapshot: SnapshotLike): Category {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    userId: toStringValue(data.userId),
    name: toStringValue(data.name),
    color: toStringValue(data.color),
    createdAt: toIsoString(data.createdAt),
  };
}
