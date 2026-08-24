"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/db/server";
import { mapProject } from "@/lib/firebase/mappers";
import type { Project } from "@/types";
import { requireSession } from "@/lib/auth/session";
import {
  type ActionResult,
  AppError,
  NotFoundError,
} from "@/lib/errors";
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
  const db = await getDb();

  const snapshot = await db.collection("projects").doc(id).get();
  if (!snapshot.exists) throw new NotFoundError("El proyecto");
  if (snapshot.get("userId") !== session.uid) throw new NotFoundError("El proyecto");

  return { session, ref: snapshot.ref };
}

async function getNextSortOrder(userId: string): Promise<number> {
  const db = await getDb();
  try {
    const lastProject = await db
      .collection("projects")
      .where("userId", "==", userId)
      .orderBy("sortOrder", "desc")
      .limit(1)
      .get();
    if (lastProject.empty) return 0;
    return Number(lastProject.docs[0].get("sortOrder") ?? -1) + 1;
  } catch {
    const allProjects = await db
      .collection("projects")
      .where("userId", "==", userId)
      .get();
    if (allProjects.empty) return 0;
    let maxSort = -1;
    for (const doc of allProjects.docs) {
      const val = Number(doc.get("sortOrder") ?? -1);
      if (val > maxSort) maxSort = val;
    }
    return maxSort + 1;
  }
}

export async function createProject(
  data: CreateProjectInput
): Promise<ActionResult<Project>> {
  try {
    const session = await requireSession();
    const db = await getDb();

    const parsed = createProjectSchema.safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const projectRef = db.collection("projects").doc();
    const now = new Date().toISOString();

    const project: Project = {
      id: projectRef.id,
      userId: session.uid,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      icon: parsed.data.icon ?? "",
      color: parsed.data.color ?? "#6b7280",
      sortOrder: await getNextSortOrder(session.uid),
      isDefault: false,
      moodleCourseId: null,
      moodlePlatform: null,
      moodleUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    await projectRef.set({
      ...project,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: project };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProject(
  id: string,
  data: Partial<CreateProjectInput>
): Promise<ActionResult<Project>> {
  try {
    const { ref } = await findUserProject(id);

    const parsed = createProjectSchema.partial().safeParse(data);
    if (!parsed.success) return validationResult(parsed.error);

    const values: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) values.name = parsed.data.name;
    if (parsed.data.description !== undefined)
      values.description = parsed.data.description ?? null;
    if (parsed.data.icon !== undefined) values.icon = parsed.data.icon ?? "";
    if (parsed.data.color !== undefined)
      values.color = parsed.data.color ?? "#6b7280";

    await ref.update({
      ...values,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await ref.get();

    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: mapProject(updated) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    const { ref } = await findUserProject(id);
    await ref.delete();

    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
