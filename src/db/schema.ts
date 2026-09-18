import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  MoodlePlatform,
  ProjectMemberRole,
  TaskPriority,
  TaskRecurrence,
  TaskSource,
  TaskStatus,
  WorkspaceRole,
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
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("projects_user_id_idx").on(table.userId),
    index("projects_user_sort_idx").on(table.userId, table.sortOrder),
    index("projects_workspace_idx").on(table.workspaceId),
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
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assigneeName: text("assignee_name").notNull().default(""),
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
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("tasks_user_archived_idx").on(table.userId, table.isArchived),
    index("tasks_project_idx").on(table.projectId),
    index("tasks_due_date_idx").on(table.dueDate),
    index("tasks_assignee_idx").on(table.assigneeId),
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

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<ProjectMemberRole>().notNull().default("viewer"),
    invitedBy: text("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    index("project_members_user_idx").on(table.userId),
  ]
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default(""),
    color: text("color").notNull().default(""),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("workspaces_created_by_idx").on(table.createdBy)]
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<WorkspaceRole>().notNull().default("member"),
    invitedBy: text("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("workspace_members_user_idx").on(table.userId),
  ]
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("task_comments_task_idx").on(table.taskId),
    index("task_comments_user_idx").on(table.userId),
  ]
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    index("push_subscriptions_user_idx").on(table.userId),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("info"),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    url: text("url").notNull().default(""),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name").notNull().default(""),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_user_read_idx").on(table.userId, table.readAt),
  ]
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    reminderPush: boolean("reminder_push").notNull().default(true),
    reminderEmail: boolean("reminder_email").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("notification_preferences_user_idx").on(table.userId),
  ]
);

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  projects: many(projects),
  categories: many(categories),
  tasks: many(tasks),
  calendarEvents: many(calendarEvents),
  scheduleBlocks: many(scheduleBlocks),
  moodleCredentials: many(moodleCredentials),
  projectMemberships: many(projectMembers),
  taskComments: many(taskComments),
  pushSubscriptions: many(pushSubscriptions),
  notificationPreferences: one(notificationPreferences),
  workspacesCreated: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  creator: one(users, {
    fields: [workspaces.createdBy],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  projects: many(projects),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
    inviter: one(users, {
      fields: [workspaceMembers.invitedBy],
      references: [users.id],
    }),
  })
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  tasks: many(tasks),
  members: many(projectMembers),
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
}));

export const projectMembersRelations = relations(
  projectMembers,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectMembers.projectId],
      references: [projects.id],
    }),
    user: one(users, {
      fields: [projectMembers.userId],
      references: [users.id],
    }),
    inviter: one(users, {
      fields: [projectMembers.invitedBy],
      references: [users.id],
    }),
  })
);

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  comments: many(taskComments),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  author: one(users, {
    fields: [taskComments.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  })
);

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type CalendarEventRow = typeof calendarEvents.$inferSelect;
export type ScheduleBlockRow = typeof scheduleBlocks.$inferSelect;
export type MoodleCredentialRow = typeof moodleCredentials.$inferSelect;
export type ProjectMemberRow = typeof projectMembers.$inferSelect;
export type TaskCommentRow = typeof taskComments.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type NotificationPreferenceRow =
  typeof notificationPreferences.$inferSelect;
