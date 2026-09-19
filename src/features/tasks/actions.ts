"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { mapTask, toDateOrNull } from "@/db/mappers";
import { projectMembers, projects, tasks, users } from "@/db/schema";
import type { Task } from "@/types";
import { requireSession, type AuthUser } from "@/lib/auth/session";
import {
  getAccessibleProjectIds,
  getProjectAccess,
  requireTaskAccess,
} from "@/lib/access";
import { createNotification } from "@/features/notifications/service";
import {
  type ActionResult,
  AppError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/lib/validations";

function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { success: false, error: error.message, code: error.code };
  }
  console.error(error);
  return { success: false, error: "Ocurrió un error inesperado" };
}

function validationResult(error: z.ZodError): ActionResult<never> {
  return {
    success: false,
    error: "Error de validación",
    errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

async function findUserTask(id: string, opts: { write?: boolean } = {}) {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) throw new NotFoundError("La tarea");

  await requireTaskAccess(row, { write: opts.write });

  return { session, row };
}

async function getNextSortOrder(userId: string): Promise<number> {
  const rows = await db
    .select({ sortOrder: tasks.sortOrder })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.sortOrder))
    .limit(1);

  return (rows[0]?.sortOrder ?? -1) + 1;
}

async function resolveAssigneeName(
  assigneeId: string,
  projectId: string | null,
  session: AuthUser
): Promise<string | null> {
  if (assigneeId === session.uid) {
    return session.displayName || session.email;
  }

  if (!projectId) return null;

  const [ownerRows, memberRows] = await Promise.all([
    db
      .select({ userId: projects.userId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1),
    db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, assigneeId)
        )
      )
      .limit(1),
  ]);

  const isOwner = ownerRows[0]?.userId === assigneeId;
  if (!isOwner && !memberRows[0]) return null;

  const userRows = await db
    .select({ displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, assigneeId))
    .limit(1);

  const target = userRows[0];
  if (!target) return null;
  return target.displayName || target.email;
}

async function notifyAssignment(
  assigneeId: string,
  actor: AuthUser,
  taskId: string,
  taskTitle: string
): Promise<void> {
  if (assigneeId === actor.uid) return;
  await createNotification({
    userId: assigneeId,
    type: "assignment",
    title: `${actor.displayName || actor.email} te asignó una tarea`,
    body: taskTitle,
    url: `/dashboard/tasks/${taskId}`,
    actorId: actor.uid,
    actorName: actor.displayName || actor.email,
  });
}

export async function createTask(
  data: CreateTaskInput
): Promise<ActionResult<Task>> {
  try {
    const session = await requireSession();

    const parsed = createTaskSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    if (parsed.data.projectId) {
      const accessible = await getAccessibleProjectIds(session);
      if (!accessible.includes(parsed.data.projectId)) {
        return {
          success: false,
          error: "No tienes acceso a este proyecto",
        };
      }
      const access = await getProjectAccess(parsed.data.projectId, session);
      if (!access || !access.readWrite) {
        return {
          success: false,
          error: "No tienes permisos de edición en este proyecto",
        };
      }
    }

    let assigneeName = "";
    if (parsed.data.assigneeId) {
      const resolved = await resolveAssigneeName(
        parsed.data.assigneeId,
        parsed.data.projectId ?? null,
        session
      );
      if (resolved === null) {
        return {
          success: false,
          error: "No puedes asignar la tarea a ese usuario",
        };
      }
      assigneeName = resolved;
    }

    const inserted = await db
      .insert(tasks)
      .values({
        userId: session.uid,
        projectId: parsed.data.projectId ?? null,
        parentId: parsed.data.parentId ?? null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: "pending",
        priority: parsed.data.priority,
        createdById: session.uid,
        createdByName: session.displayName,
        assigneeId: parsed.data.assigneeId ?? null,
        assigneeName,
        startDate: toDateOrNull(parsed.data.startDate ?? null),
        dueDate: toDateOrNull(parsed.data.dueDate ?? null),
        estimatedHours: parsed.data.estimatedHours ?? null,
        recurrence:
          parsed.data.recurrence === "none" ? null : parsed.data.recurrence,
        sortOrder: await getNextSortOrder(session.uid),
        reminderAt: toDateOrNull(parsed.data.reminderAt ?? null),
        categories: parsed.data.categories ?? [],
        source: "manual",
      })
      .returning();

    if (parsed.data.assigneeId) {
      await notifyAssignment(
        parsed.data.assigneeId,
        session,
        inserted[0]!.id,
        inserted[0]!.title
      );
    }

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapTask(inserted[0]!) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateTask(
  id: string,
  data: UpdateTaskInput,
  expectedUpdatedAt?: string
): Promise<ActionResult<Task>> {
  try {
    const parsed = updateTaskSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const { row: existing, session } = await findUserTask(id, { write: true });

    if (
      expectedUpdatedAt &&
      existing.updatedAt.toISOString() !== expectedUpdatedAt
    ) {
      throw new ConflictError(
        "Esta tarea cambió en el servidor desde tu última edición."
      );
    }

    const values: Partial<typeof tasks.$inferInsert> = {};

    if (parsed.data.projectId !== undefined && parsed.data.projectId) {
      const accessible = await getAccessibleProjectIds(session);
      if (!accessible.includes(parsed.data.projectId)) {
        return {
          success: false,
          error: "No tienes acceso a este proyecto",
        };
      }
      const destinationAccess = await getProjectAccess(
        parsed.data.projectId,
        session
      );
      if (!destinationAccess || !destinationAccess.readWrite) {
        return {
          success: false,
          error: "No tienes permisos de edición en este proyecto",
        };
      }
    }

    if (parsed.data.assigneeId !== undefined) {
      if (parsed.data.assigneeId === null) {
        values.assigneeId = null;
        values.assigneeName = "";
      } else {
        const name = await resolveAssigneeName(
          parsed.data.assigneeId,
          parsed.data.projectId ?? existing.projectId,
          session
        );
        if (name === null) {
          return {
            success: false,
            error: "No puedes asignar la tarea a ese usuario",
          };
        }
        values.assigneeId = parsed.data.assigneeId;
        values.assigneeName = name;
      }
    }

    if (parsed.data.title !== undefined) values.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      values.description = parsed.data.description ?? null;
    if (parsed.data.projectId !== undefined)
      values.projectId = parsed.data.projectId ?? null;
    if (parsed.data.priority !== undefined)
      values.priority = parsed.data.priority;
    if (parsed.data.startDate !== undefined)
      values.startDate = toDateOrNull(parsed.data.startDate ?? null);
    if (parsed.data.dueDate !== undefined)
      values.dueDate = toDateOrNull(parsed.data.dueDate ?? null);
    if (parsed.data.estimatedHours !== undefined)
      values.estimatedHours = parsed.data.estimatedHours ?? null;
    if (parsed.data.parentId !== undefined)
      values.parentId = parsed.data.parentId ?? null;
    if (parsed.data.recurrence !== undefined) {
      values.recurrence =
        parsed.data.recurrence === "none" ? null : parsed.data.recurrence;
    }
    if (parsed.data.status !== undefined) {
      values.status = parsed.data.status;
      values.completedAt =
        parsed.data.status === "completed" ? new Date() : null;
    }
    if (parsed.data.isArchived !== undefined)
      values.isArchived = parsed.data.isArchived;
    if (parsed.data.actualHours !== undefined)
      values.actualHours = parsed.data.actualHours ?? null;
    if (parsed.data.categories !== undefined)
      values.categories = parsed.data.categories;
    if (parsed.data.pdfUrl !== undefined)
      values.pdfUrl = parsed.data.pdfUrl ?? null;
    if (parsed.data.pdfName !== undefined)
      values.pdfName = parsed.data.pdfName ?? null;
    if (parsed.data.reminderAt !== undefined) {
      values.reminderAt = toDateOrNull(parsed.data.reminderAt ?? null);
      values.reminderSentAt = null;
    }

    values.updatedAt = new Date();

    const updated = await db
      .update(tasks)
      .set(values)
      .where(eq(tasks.id, id))
      .returning();

    if (
      parsed.data.assigneeId &&
      parsed.data.assigneeId !== existing.assigneeId
    ) {
      await notifyAssignment(
        parsed.data.assigneeId,
        session,
        id,
        updated[0]!.title
      );
    }

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${id}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapTask(updated[0]!) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    await findUserTask(id, { write: true });
    await db.delete(tasks).where(eq(tasks.id, id));

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateTaskStatus(
  id: string,
  status: Task["status"],
  expectedUpdatedAt?: string
): Promise<ActionResult<Task>> {
  try {
    const { row: existing } = await findUserTask(id, { write: true });

    if (
      expectedUpdatedAt &&
      existing.updatedAt.toISOString() !== expectedUpdatedAt
    ) {
      throw new ConflictError(
        "Esta tarea cambió en el servidor desde tu última edición."
      );
    }

    const updated = await db
      .update(tasks)
      .set({
        status,
        completedAt: status === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/tasks/${id}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapTask(updated[0]!) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function restoreTask(id: string): Promise<ActionResult<Task>> {
  try {
    await findUserTask(id, { write: true });

    const updated = await db
      .update(tasks)
      .set({ isArchived: false, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/tasks/archived");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapTask(updated[0]!) };
  } catch (error) {
    return toActionError(error);
  }
}
