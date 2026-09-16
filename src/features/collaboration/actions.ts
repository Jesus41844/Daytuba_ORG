"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { projectMembers, projects, users } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import {
  requireProjectAccess,
  requireProjectOwner,
} from "@/lib/access";
import { sendPushNotification } from "@/lib/push";
import {
  type ActionResult,
  AppError,
  NotFoundError,
  ConflictError,
} from "@/lib/errors";
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from "@/lib/validations";
import type { ProjectMemberProfile } from "./queries";

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

export async function inviteMember(
  data: InviteMemberInput
): Promise<ActionResult<ProjectMemberProfile>> {
  try {
    const session = await requireSession();

    const parsed = inviteMemberSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    await requireProjectAccess(parsed.data.projectId, { write: true });

    const userRows = await db
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    const target = userRows[0];
    if (!target) throw new NotFoundError("No existe un usuario con ese email");

    if (target.id === session.uid) {
      return {
        success: false,
        error: "No puedes agregarte a ti mismo: ya eres el propietario",
      };
    }

    const alreadyMember = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, parsed.data.projectId),
          eq(projectMembers.userId, target.id)
        )
      )
      .limit(1);

    if (alreadyMember[0]) {
      throw new ConflictError("El usuario ya es miembro de este proyecto");
    }

    await db.insert(projectMembers).values({
      projectId: parsed.data.projectId,
      userId: target.id,
      role: parsed.data.role,
      invitedBy: session.uid,
    });

    const joinedAt = await db
      .select({ createdAt: projectMembers.createdAt })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, parsed.data.projectId),
          eq(projectMembers.userId, target.id)
        )
      )
      .limit(1);

    try {
      const projectRow = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, parsed.data.projectId))
        .limit(1);
      await sendPushNotification(target.id, {
        title: `${session.displayName || session.email} te invitó a un proyecto`,
        body: `Ahora tienes acceso a "${projectRow[0]?.name ?? "nuevo proyecto"}" como ${
          parsed.data.role === "editor" ? "editor" : "lector"
        }`,
        url: `/dashboard/projects/${parsed.data.projectId}`,
      });
    } catch {
      // push must never break the invite flow
    }

    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);

    return {
      success: true,
      data: {
        userId: target.id,
        email: target.email,
        displayName: target.displayName,
        role: parsed.data.role,
        joinedAt: joinedAt[0]?.createdAt ?? new Date(),
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateMemberRole(
  data: UpdateMemberRoleInput
): Promise<ActionResult> {
  try {
    const parsed = updateMemberRoleSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    await requireProjectOwner(parsed.data.projectId);

    await db
      .update(projectMembers)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(
        and(
          eq(projectMembers.projectId, parsed.data.projectId),
          eq(projectMembers.userId, parsed.data.memberUserId)
        )
      );

    revalidatePath("/dashboard/projects");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeMember(
  projectId: string,
  memberUserId: string
): Promise<ActionResult> {
  try {
    await requireProjectOwner(projectId);

    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, memberUserId)
        )
      );

    revalidatePath("/dashboard/projects");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}