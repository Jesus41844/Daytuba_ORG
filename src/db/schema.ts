import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  MoodlePlatform,
  TaskPriority,
  TaskRecurrence,
  TaskSource,
  TaskStatus,
} from "../types/task";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  photoUrl: text("photo_url"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("user"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon").notNull().default(""),
    color: text("color").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    moodleCourseId: text("moodle_course_id"),
    moodlePlatform: text("moodle_platform").$type<MoodlePlatform>(),
    moodleUrl: text("moodle_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("projects_user_id_idx").on(table.userId),
    index("projects_user_sort_idx").on(table.userId, table.sortOrder),
  ]
);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("categories_user_name_unique").on(table.userId, table.name),
  ]
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    parentId: text("parent_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").$type<TaskStatus>().notNull().default("pending"),
    priority: text("priority")
      .$type<TaskPriority>()
      .notNull()
      .default("medium"),
    createdById: text("created_by_id").notNull().default(""),
    createdByName: text("created_by_name").notNull().default(""),
    startDate: timestamp("start_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    estimatedHours: doublePrecision("estimated_hours"),
    actualHours: doublePrecision("actual_hours"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    recurrence: text("recurrence").$type<TaskRecurrence>(),
    isArchived: boolean("is_archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    categories: text("categories")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    pdfUrl: text("pdf_url"),
    pdfName: text("pdf_name"),
    source: text("source").$type<TaskSource>().notNull().default("manual"),
    moodlePlatform: text("moodle_platform").$type<MoodlePlatform>(),
    moodleCourseId: text("moodle_course_id"),
    moodleAssignmentId: text("moodle_assignment_id"),
    moodleUrl: text("moodle_url"),
    reminderAt: timestamp("reminder_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("tasks_user_archived_idx").on(table.userId, table.isArchived),
    index("tasks_project_idx").on(table.projectId),
    index("tasks_due_date_idx").on(table.dueDate),
  ]
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startTime: text("start_time").notNull().default("09:00"),
    endTime: text("end_time").notNull().default("10:00"),
    color: text("color").notNull().default("#0b57d0"),
    date: text("date"),
    dayOfWeek: integer("day_of_week"),
    createdAt: createdAt(),
  },
  (table) => [index("calendar_events_user_idx").on(table.userId)]
);

export const scheduleBlocks = pgTable(
  "schedule_blocks",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dayOfWeek: integer("day_of_week").notNull().default(0),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    color: text("color").notNull().default("#0b57d0"),
    pdfUrl: text("pdf_url"),
    pdfName: text("pdf_name"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("schedule_blocks_user_idx").on(table.userId)]
);

export const moodleCredentials = pgTable(
  "moodle_credentials",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").$type<MoodlePlatform>().notNull(),
    username: text("username").notNull(),
    encryptedPassword: text("encrypted_password").notNull(),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("moodle_credentials_user_platform_unique").on(
      table.userId,
      table.platform
    ),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  projects: many(projects),
  categories: many(categories),
  tasks: many(tasks),
  calendarEvents: many(calendarEvents),
  scheduleBlocks: many(scheduleBlocks),
  moodleCredentials: many(moodleCredentials),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type CalendarEventRow = typeof calendarEvents.$inferSelect;
export type ScheduleBlockRow = typeof scheduleBlocks.$inferSelect;
export type MoodleCredentialRow = typeof moodleCredentials.$inferSelect;
