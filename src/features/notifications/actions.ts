"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";

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
