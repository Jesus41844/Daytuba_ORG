import type {
  CategoryRow,
  NotificationRow,
  ProjectRow,
  TaskRow,
  WorkspaceRow,
} from "@/db/schema";
import type {
  AppNotification,
  Category,
  MoodlePlatform,
  Project,
  Task,
  TaskPriority,
  TaskRecurrence,
  TaskSource,
  TaskStatus,
  Workspace,
} from "@/types";

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    parentId: row.parentId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdById: row.createdById,
    createdByName: row.createdByName,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName,
    startDate: toIso(row.startDate),
    dueDate: toIso(row.dueDate),
    estimatedHours: row.estimatedHours,
    actualHours: row.actualHours,
    completedAt: toIso(row.completedAt),
    recurrence: row.recurrence ?? null,
    isArchived: row.isArchived,
    sortOrder: row.sortOrder,
    categories: row.categories ?? [],
    pdfUrl: row.pdfUrl,
    pdfName: row.pdfName,
    source: row.source,
    moodlePlatform: row.moodlePlatform ?? null,
    moodleCourseId: row.moodleCourseId,
    moodleAssignmentId: row.moodleAssignmentId,
    moodleUrl: row.moodleUrl,
    reminderAt: toIso(row.reminderAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sortOrder,
    isDefault: row.isDefault,
    moodleCourseId: row.moodleCourseId,
    moodlePlatform: row.moodlePlatform ?? null,
    moodleUrl: row.moodleUrl,
    workspaceId: row.workspaceId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as AppNotification["type"],
    title: row.title,
    body: row.body,
    url: row.url,
    actorId: row.actorId,
    actorName: row.actorName,
    readAt: toIso(row.readAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseTaskStatus(value: string): TaskStatus {
  const allowed: TaskStatus[] = [
    "pending",
    "in_progress",
    "review",
    "completed",
    "cancelled",
  ];
  return allowed.includes(value as TaskStatus)
    ? (value as TaskStatus)
    : "pending";
}

export function parseTaskPriority(value: string): TaskPriority {
  const allowed: TaskPriority[] = ["low", "medium", "high", "urgent"];
  return allowed.includes(value as TaskPriority)
    ? (value as TaskPriority)
    : "medium";
}

export function parseTaskRecurrence(
  value: string | null
): TaskRecurrence {
  if (value === null || value === "none") return null;
  const allowed: Exclude<TaskRecurrence, null>[] = [
    "daily",
    "weekly",
    "biweekly",
    "monthly",
    "yearly",
  ];
  return allowed.includes(value as Exclude<TaskRecurrence, null>)
    ? (value as TaskRecurrence)
    : null;
}

export function parseMoodlePlatform(value: string | null): MoodlePlatform | null {
  const allowed: MoodlePlatform[] = [
    "ecampus",
    "campusvirtual",
    "virtualutp",
  ];
  return value && allowed.includes(value as MoodlePlatform)
    ? (value as MoodlePlatform)
    : null;
}

export function parseTaskSource(value: string | null): TaskSource {
  return value === "moodle" ? "moodle" : "manual";
}
