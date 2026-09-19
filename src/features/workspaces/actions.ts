"use server";

import { and, asc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { mapWorkspace } from "@/db/mappers";
import {
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { getWorkspaceRole, requireWorkspaceAdmin } from "@/lib/access";
import { setActiveWorkspaceCookie } from "@/lib/active-workspace";
import { sendPushNotification } from "@/lib/push";
import { createNotification } from "@/features/notifications/service";
import {
  type ActionResult,
  AppError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import {
  createWorkspaceSchema,
  inviteWorkspaceMemberSchema,
  updateWorkspaceMemberRoleSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type InviteWorkspaceMemberInput,
  type UpdateWorkspaceInput,
  type UpdateWorkspaceMemberRoleInput,
} from "@/lib/validations";
import type { Workspace, WorkspaceMember, WorkspaceRole } from "@/types";

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

function roleLabel(role: WorkspaceRole): string {
  if (role === "admin") return "administrador";
  if (role === "member") return "miembro";
  return "solo lectura";
}

function revalidateWorkspace() {
  revalidatePath("/dashboard/workspaces");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard");
}

export async function createWorkspace(
  data: CreateWorkspaceInput
): Promise<ActionResult<Workspace>> {
  try {
    const session = await requireSession();

    const parsed = createWorkspaceSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const workspace = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(workspaces)
        .values({
          name: parsed.data.name,
          icon: parsed.data.icon ?? "",
          color: parsed.data.color ?? "#6366f1",
          createdBy: session.uid,
        })
        .returning();

      await tx.insert(workspaceMembers).values({
        workspaceId: created.id,
        userId: session.uid,
        role: "admin",
        invitedBy: session.uid,
      });

      return created;
    });

    revalidateWorkspace();
    return { success: true, data: mapWorkspace(workspace) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateWorkspace(
  data: UpdateWorkspaceInput
): Promise<ActionResult<Workspace>> {
  try {
    const parsed = updateWorkspaceSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    await requireWorkspaceAdmin(parsed.data.workspaceId);

    const updated = await db
      .update(workspaces)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.icon !== undefined && {
          icon: parsed.data.icon ?? "",
        }),
        ...(parsed.data.color !== undefined && {
          color: parsed.data.color ?? "#6366f1",
        }),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, parsed.data.workspaceId))
      .returning();

    revalidateWorkspace();
    return { success: true, data: mapWorkspace(updated[0]!) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteWorkspace(workspaceId: string): Promise<ActionResult> {
  try {
    await requireWorkspaceAdmin(workspaceId);
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    revalidateWorkspace();
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function inviteWorkspaceMember(
  data: InviteWorkspaceMemberInput
): Promise<ActionResult<WorkspaceMember>> {
  try {
    const session = await requireSession();

    const parsed = inviteWorkspaceMemberSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    await requireWorkspaceAdmin(parsed.data.workspaceId);

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
        error: "Ya eres administrador de este espacio de trabajo",
      };
    }

    const alreadyMember = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, parsed.data.workspaceId),
          eq(workspaceMembers.userId, target.id)
        )
      )
      .limit(1);

    if (alreadyMember[0]) {
      throw new ConflictError("El usuario ya es miembro de este espacio");
    }

    await db.insert(workspaceMembers).values({
      workspaceId: parsed.data.workspaceId,
      userId: target.id,
      role: parsed.data.role,
      invitedBy: session.uid,
    });

    const joined = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, parsed.data.workspaceId),
          eq(workspaceMembers.userId, target.id)
        )
      )
      .limit(1);

    const workspace = await db
      .select({ name: workspaces.name, id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, parsed.data.workspaceId))
      .limit(1);

    const workspaceName = workspace[0]?.name ?? "espacio de trabajo";
    const actorName = session.displayName || session.email;

    try {
      await sendPushNotification(target.id, {
        title: `${actorName} te añadió a un espacio de trabajo`,
        body: `Tienes acceso a "${workspaceName}" como ${roleLabel(parsed.data.role)}`,
        url: `/dashboard/workspaces`,
      });

      await createNotification({
        userId: target.id,
        type: "invite",
        title: `${actorName} te añadió a un espacio de trabajo`,
        body: `Tienes acceso a "${workspaceName}" como ${roleLabel(parsed.data.role)}`,
        url: `/dashboard/workspaces`,
        actorId: session.uid,
        actorName,
      });
    } catch {
      // push must never break the invite flow
    }

    revalidateWorkspace();
    return {
      success: true,
      data: {
        workspaceId: parsed.data.workspaceId,
        userId: target.id,
        email: target.email,
        displayName: target.displayName,
        role: parsed.data.role,
        joinedAt: joined[0]?.joinedAt ?? new Date(),
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateWorkspaceMemberRole(
  data: UpdateWorkspaceMemberRoleInput
): Promise<ActionResult> {
  try {
    const parsed = updateWorkspaceMemberRoleSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    await requireWorkspaceAdmin(parsed.data.workspaceId);

    await db
      .update(workspaceMembers)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceMembers.workspaceId, parsed.data.workspaceId),
          eq(workspaceMembers.userId, parsed.data.memberUserId)
        )
      );

    revalidateWorkspace();
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberUserId: string
): Promise<ActionResult> {
  try {
    await requireWorkspaceAdmin(workspaceId);

    const session = await requireSession();
    if (memberUserId === session.uid) {
      return {
        success: false,
        error: "No puedes eliminarte a ti mismo; usa 'Salir del espacio'",
      };
    }

    await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, memberUserId)
        )
      );

    revalidateWorkspace();
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function leaveWorkspace(workspaceId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const myMembership = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, session.uid)
        )
      )
      .limit(1);

    const role = myMembership[0]?.role;
    if (!role) {
      throw new NotFoundError("El espacio de trabajo");
    }

    if (role === "admin") {
      const otherAdmins = await db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.role, "admin"),
            ne(workspaceMembers.userId, session.uid)
          )
        );

      if (otherAdmins.length === 0) {
        const otherMembers = await db
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              ne(workspaceMembers.userId, session.uid)
            )
          )
          .orderBy(asc(workspaceMembers.createdAt))
          .limit(1);

        if (otherMembers[0]) {
          await db
            .update(workspaceMembers)
            .set({ role: "admin", updatedAt: new Date() })
            .where(
              and(
                eq(workspaceMembers.workspaceId, workspaceId),
                eq(workspaceMembers.userId, otherMembers[0].userId)
              )
            );
        } else {
          await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
        }
      }
    }

    await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, session.uid)
        )
      );

    revalidateWorkspace();
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setActiveWorkspace(
  workspaceId: string | null
): Promise<ActionResult<void>> {
  try {
    const session = await requireSession();

    if (workspaceId !== null) {
      const role = await getWorkspaceRole(workspaceId, session.uid);
      if (!role) throw new NotFoundError("El espacio de trabajo");
    }

    await setActiveWorkspaceCookie(workspaceId);
    revalidatePath("/(app)", "layout");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}