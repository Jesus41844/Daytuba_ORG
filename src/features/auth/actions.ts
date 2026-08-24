"use server";

import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createUserSession,
  destroyCurrentSession,
  requireSession,
} from "@/lib/auth/session";
import type { ActionResult } from "@/lib/errors";
import { loginSchema, registerSchema } from "@/lib/validations";

const BCRYPT_ROUNDS = 12;

const profileSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  photoUrl: z.string().max(2048).nullable().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export async function login(
  email: string,
  password: string
): Promise<ActionResult<void>> {
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { success: false, error: "Email o contraseña inválidos" };
  }

  let authenticated = false;

  try {
    const rows = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, parsed.data.email.toLowerCase()))
      .limit(1);

    const user = rows[0];

    if (user?.passwordHash) {
      authenticated = await compare(parsed.data.password, user.passwordHash);
    }

    if (!authenticated) {
      return {
        success: false,
        error: "Credenciales inválidas. Verifica tu email y contraseña.",
      };
    }

    await createUserSession(user!.id);
  } catch (error) {
    console.error("Error logging in:", error);
    return {
      success: false,
      error: "No se pudo iniciar sesión. Intenta de nuevo.",
    };
  }

  redirect("/dashboard");
}

export async function register(
  displayName: string,
  email: string,
  password: string
): Promise<ActionResult<void>> {
  const parsed = registerSchema.safeParse({
    displayName,
    email,
    password,
    confirmPassword: password,
  });
  if (!parsed.success) {
    return { success: false, error: "Datos de registro inválidos" };
  }

  try {
    const normalizedEmail = parsed.data.email.toLowerCase();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "Ya existe una cuenta con este email." };
    }

    const passwordHash = await hash(parsed.data.password, BCRYPT_ROUNDS);

    const inserted = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        displayName: parsed.data.displayName,
        passwordHash,
      })
      .returning({ id: users.id });

    await createUserSession(inserted[0]!.id);
  } catch (error) {
    console.error("Error registering:", error);
    return {
      success: false,
      error: "No se pudo crear la cuenta. Intenta de nuevo.",
    };
  }

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}

export async function updateUserProfile(data: {
  displayName?: string;
  photoUrl?: string;
}): Promise<ActionResult<void>> {
  try {
    const session = await requireSession();

    const parsed = profileSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Datos de perfil inválidos" };
    }

    await db
      .update(users)
      .set({
        ...(parsed.data.displayName !== undefined && {
          displayName: parsed.data.displayName,
        }),
        ...(parsed.data.photoUrl !== undefined && {
          photoUrl: parsed.data.photoUrl || null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.uid));

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { success: false, error: "No se pudo actualizar el perfil." };
  }
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult<void>> {
  try {
    const session = await requireSession();

    const parsed = changePasswordSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "La nueva contraseña es demasiado débil." };
    }

    const rows = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.uid))
      .limit(1);

    const user = rows[0];

    if (!user?.passwordHash) {
      return { success: false, error: "No hay sesión activa" };
    }

    const valid = await compare(
      parsed.data.currentPassword,
      user.passwordHash
    );

    if (!valid) {
      return { success: false, error: "La contraseña actual es incorrecta." };
    }

    const newPasswordHash = await hash(parsed.data.newPassword, BCRYPT_ROUNDS);

    await db
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, session.uid));

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error changing password:", error);
    return { success: false, error: "No se pudo cambiar la contraseña." };
  }
}
