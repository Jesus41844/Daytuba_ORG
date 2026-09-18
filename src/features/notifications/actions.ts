"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { notifications, notificationPreferences } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import type { ReminderPreferences } from "./queries";

export async function markNotificationRead(id: string): Promise<void> {
  const session = await requireSession();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, session.uid))
    );

  revalidatePath("/dashboard", "layout");
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await requireSession();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, session.uid),
        isNull(notifications.readAt)
      )
    );

  revalidatePath("/dashboard", "layout");
}

export async function updateReminderPreferences(
  input: ReminderPreferences
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();

  try {
    await db
      .insert(notificationPreferences)
      .values({
        userId: session.uid,
        reminderPush: input.reminderPush,
        reminderEmail: input.reminderEmail,
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          reminderPush: input.reminderPush,
          reminderEmail: input.reminderEmail,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    console.error("No se pudieron guardar las preferencias", error);
    return { success: false, error: "No se pudieron guardar las preferencias" };
  }
}
