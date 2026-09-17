"use server";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { mapNotification } from "@/db/mappers";
import { notifications } from "@/db/schema";
import type { AppNotification } from "@/types";
import { requireSession } from "@/lib/auth/session";

export async function getNotifications(
  limit = 20
): Promise<AppNotification[]> {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, session.uid))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map(mapNotification);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const session = await requireSession();

  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.uid),
        isNull(notifications.readAt)
      )
    );

  return rows.length;
}
