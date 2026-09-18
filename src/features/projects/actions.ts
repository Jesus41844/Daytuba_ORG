"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { mapProject } from "@/db/mappers";
import { projects } from "@/db/schema";
import type { Project } from "@/types";
import { requireSession } from "@/lib/auth/session";
import {
  type ActionResult,
  AppError,
  NotFoundError,
} from "@/lib/errors";
import { requireProjectOwner, requireWorkspaceAccess } from "@/lib/access";
import {
  createProjectSchema,
  type CreateProjectInput,
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

async function findUserProject(id: string) {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) throw new NotFoundError("El proyecto");

  await requireProjectOwner(row.id);

  return { session, row };
}

async function getNextSortOrder(userId: string): Promise<number> {
  const rows = await db
    .select({ sortOrder: projects.sortOrder })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.sortOrder))
    .limit(1);

  return (rows[0]?.sortOrder ?? -1) + 1;
}

export async function createProject(
  data: CreateProjectInput
): Promise<ActionResult<Project>> {
  try {
    const session = await requireSession();

    const parsed = createProjectSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const workspaceId = parsed.data.workspaceId ?? null;
    if (workspaceId) {
      await requireWorkspaceAccess(workspaceId, { write: true });
    }

    const inserted = await db
      .insert(projects)
      .values({
        userId: session.uid,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        icon: parsed.data.icon ?? "",
        color: parsed.data.color ?? "#6b7280",
        sortOrder: await getNextSortOrder(session.uid),
        isDefault: false,
        workspaceId,
      })
      .returning();

    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapProject(inserted[0]!) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProject(
  id: string,
  data: Partial<CreateProjectInput>
): Promise<ActionResult<Project>> {
  try {
    await findUserProject(id);

    const parsed = createProjectSchema.partial().safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const updated = await db
      .update(projects)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description ?? null,
        }),
        ...(parsed.data.icon !== undefined && {
          icon: parsed.data.icon ?? "",
        }),
        ...(parsed.data.color !== undefined && {
          color: parsed.data.color ?? "#6b7280",
        }),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapProject(updated[0]!) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    await findUserProject(id);
    await db.delete(projects).where(eq(projects.id, id));

    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
