export type TaskStatus =
  | "pending"
  | "in_progress"
  | "review"
  | "completed"
  | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskRecurrence =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly"
  | null;

export type TaskSource = "manual" | "moodle";
export type MoodlePlatform = "ecampus" | "campusvirtual" | "virtualutp";

export type ProjectMemberRole = "viewer" | "editor";

export interface Task {
  id: string;
  userId: string;
  projectId: string | null;
  parentId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdById: string;
  createdByName: string;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  completedAt: string | null;
  recurrence: TaskRecurrence;
  isArchived: boolean;
  sortOrder: number;
  categories: string[];
  pdfUrl: string | null;
  pdfName: string | null;
  source: TaskSource;
  moodlePlatform: MoodlePlatform | null;
  moodleCourseId: string | null;
  moodleAssignmentId: string | null;
  moodleUrl: string | null;
  reminderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  moodleCourseId: string | null;
  moodlePlatform: MoodlePlatform | null;
  moodleUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  authorName: string;
  authorEmail: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
