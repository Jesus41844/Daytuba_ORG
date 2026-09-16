import type { Project, Task, TaskPriority } from "@/types";
import type { MoodleCourse, MoodleEvent, MoodlePlatform } from "../types";

const MODULE_LABELS: Record<string, string> = {
  assign: "Tarea",
  quiz: "Quiz",
  workshop: "Workshop",
};

const COURSE_COLORS = [
  "#0b57d0", "#0d652d", "#b3261e", "#7c5800", "#6750a4",
  "#006a6a", "#984061", "#5c6bc0", "#00897b", "#e65100",
];

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function getPriority(dueDate: Date): TaskPriority {
  const now = new Date();
  const days = daysBetween(now, dueDate);
  if (days < 0) return "urgent";
  if (days <= 2) return "urgent";
  if (days <= 5) return "high";
  if (days <= 14) return "medium";
  return "low";
}

export function moodleCourseToProject(
  course: MoodleCourse,
  platform: MoodlePlatform,
  userId: string
): Omit<Project, "id" | "sortOrder" | "createdAt" | "updatedAt"> {
  const colorIndex = course.id % COURSE_COLORS.length;
  return {
    userId,
    name: course.shortname || course.fullname,
    description: course.fullname !== course.shortname ? course.fullname : null,
    icon: "",
    color: COURSE_COLORS[colorIndex]!,
    isDefault: false,
    moodleCourseId: String(course.id),
    moodlePlatform: platform,
    moodleUrl: null,
  };
}

export function moodleEventToTask(
  event: MoodleEvent,
  course: MoodleCourse | undefined,
  platform: MoodlePlatform,
  userId: string,
  projectId?: string | null
): Omit<Task, "id" | "sortOrder" | "createdAt" | "updatedAt"> {
  const courseLabel =
    course?.shortname ||
    (event.courseid == null ? "Sin curso" : `Curso ${event.courseid}`);
  const moduleLabel = MODULE_LABELS[event.modulename] ?? event.modulename;
  const dueDate = new Date(event.timestart * 1000);

  return {
    userId,
    projectId: projectId ?? null,
    parentId: null,
    title: `[${courseLabel}] ${moduleLabel}: ${event.name}`,
    description: event.description || null,
    status: "pending",
    priority: getPriority(dueDate),
    createdById: "moodle-sync",
    createdByName: "Moodle",
    startDate: null,
    dueDate: dueDate.toISOString(),
    estimatedHours: null,
    actualHours: null,
    completedAt: null,
    recurrence: null,
    isArchived: false,
    categories: [],
    pdfUrl: null,
    pdfName: null,
    reminderAt: null,
    moodlePlatform: platform,
    moodleCourseId:
      event.courseid == null ? null : String(event.courseid),
    moodleAssignmentId: String(event.id),
    moodleUrl: event.url,
    source: "moodle",
  };
}

export function buildCourseMap(courses: MoodleCourse[]): Map<number, MoodleCourse> {
  const map = new Map<number, MoodleCourse>();
  for (const course of courses) {
    map.set(course.id, course);
  }
  return map;
}
