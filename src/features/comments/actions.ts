"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { projectMembers, projects, taskComments, tasks, users } from "@/db/schema";
import type { TaskComment } from "@/types";
import { requireSession } from "@/lib/auth/session";
import { requireTaskAccess } from "@/lib/access";
import { sendPushNotification } from "@/lib/push";
import { createNotification } from "@/features/notifications/service";
import {
  type ActionResult,
  AppError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import {
  createCommentSchema,
  type CreateCommentInput,
} from "@/lib/validations";

function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { success: false, error: error.message };
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

export async function createComment(
  data: CreateCommentInput
): Promise<ActionResult<TaskComment>> {
  try {
    const session = await requireSession();

    const parsed = createCommentSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const task = await db
      .select({ userId: tasks.userId, projectId: tasks.projectId, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, parsed.data.taskId))
      .limit(1);

    if (!task[0]) throw new NotFoundError("La tarea");
    await requireTaskAccess(task[0], { write: true });

    const inserted = await db
      .insert(taskComments)
      .values({
        taskId: parsed.data.taskId,
        userId: session.uid,
        body: parsed.data.body,
      })
      .returning();

    const author = await db
      .select({ email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, session.uid))
      .limit(1);

    revalidatePath(`/dashboard/tasks/${parsed.data.taskId}`);
    revalidatePath("/dashboard/tasks");

    try {
      const authorName = author[0]?.displayName || session.displayName;
      const recipientIds = new Set<string>();

      if (task[0].projectId) {
        const memberRows = await db
          .select({ userId: projectMembers.userId })
          .from(projectMembers)
          .where(eq(projectMembers.projectId, task[0].projectId));
        for (const m of memberRows) recipientIds.add(m.userId);

        const ownerRows = await db
          .select({ userId: projects.userId })
          .from(projects)
          .where(eq(projects.id, task[0].projectId))
          .limit(1);
        if (ownerRows[0]) recipientIds.add(ownerRows[0].userId);
      } else {
        recipientIds.add(task[0].userId);
      }

      recipientIds.delete(session.uid);

      await Promise.all(
        [...recipientIds].map((uid) =>
          sendPushNotification(uid, {
            title: `${authorName} comentó en "${task[0].title}"`,
            body: parsed.data.body.slice(0, 120),
            url: `/dashboard/tasks/${parsed.data.taskId}`,
          })
        )
      );

      await Promise.all(
        [...recipientIds].map((uid) =>
          createNotification({
            userId: uid,
            type: "comment",
            title: `${authorName} comentó en "${task[0].title}"`,
            body: parsed.data.body.slice(0, 120),
            url: `/dashboard/tasks/${parsed.data.taskId}`,
            actorId: session.uid,
            actorName: authorName,
          })
        )
      );
    } catch {
      // push must never break the comment flow
    }

    return {
      success: true,
      data: {
        id: inserted[0]!.id,
        taskId: inserted[0]!.taskId,
        userId: inserted[0]!.userId,
        authorName: author[0]?.displayName ?? session.displayName,
        authorEmail: author[0]?.email ?? "",
        body: inserted[0]!.body,
        createdAt: inserted[0]!.createdAt.toISOString(),
        updatedAt: inserted[0]!.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select({
        id: taskComments.id,
        taskId: taskComments.taskId,
        userId: taskComments.userId,
        taskUserId: tasks.userId,
        taskProjectId: tasks.projectId,
      })
      .from(taskComments)
      .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
      .where(eq(taskComments.id, commentId))
      .limit(1);

    const comment = rows[0];
    if (!comment) throw new NotFoundError("El comentario");

    const isAuthor = comment.userId === session.uid;
    const isTaskCreator = comment.taskUserId === session.uid;

    if (!isAuthor && !isTaskCreator) {
      throw new ForbiddenError("No tienes permiso para eliminar este comentario");
    }

    await db.delete(taskComments).where(eq(taskComments.id, commentId));

    revalidatePath(`/dashboard/tasks/${comment.taskId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}