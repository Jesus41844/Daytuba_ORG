import { and, eq, gte, inArray, isNotNull, isNull, lte, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { createNotification } from "@/features/notifications/service";
import { sendEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/push";
import {
  buildReminderPayload,
  CATCHUP_WINDOW_MS,
  getAppBaseUrl,
} from "@/lib/reminders";
import { notificationPreferences, tasks, users } from "@/db/schema";
import type { TaskStatus } from "@/types/task";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPLETED_STATUSES: TaskStatus[] = ["completed", "cancelled"];

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - CATCHUP_WINDOW_MS);

  // Reclama de forma atómica las tareas con recordatorio vencido que aún no
  // se notificaron, para que ningún run del cron las envíe dos veces.
  const claimed = await db
    .update(tasks)
    .set({ reminderSentAt: now, updatedAt: now })
    .where(
      and(
        isNotNull(tasks.reminderAt),
        lte(tasks.reminderAt, now),
        gte(tasks.reminderAt, windowStart),
        isNull(tasks.reminderSentAt),
        notInArray(tasks.status, COMPLETED_STATUSES),
        eq(tasks.isArchived, false)
      )
    )
    .returning({
      id: tasks.id,
      userId: tasks.userId,
      title: tasks.title,
      dueDate: tasks.dueDate,
    });

  if (claimed.length === 0) {
    return NextResponse.json({ ok: true, claimed: 0, notified: 0, emails: 0 });
  }

  const userIds = [...new Set(claimed.map((row) => row.userId))];

  const [userRows, prefRows] = await Promise.all([
    db.select().from(users).where(inArray(users.id, userIds)),
    db
      .select()
      .from(notificationPreferences)
      .where(inArray(notificationPreferences.userId, userIds)),
  ]);

  const usersById = new Map(userRows.map((user) => [user.id, user]));
  const prefsById = new Map(prefRows.map((pref) => [pref.userId, pref]));

  const baseUrl = getAppBaseUrl();
  let notified = 0;
  let emails = 0;

  for (const task of claimed) {
    const user = usersById.get(task.userId);
    if (!user) continue;

    const prefs = prefsById.get(task.userId);
    const payload = buildReminderPayload(task, { baseUrl });

    await createNotification({
      userId: task.userId,
      type: "reminder",
      title: payload.title,
      body: payload.body,
      url: payload.path,
    });

    if (prefs?.reminderPush ?? true) {
      try {
        await sendPushNotification(task.userId, {
          title: payload.title,
          body: payload.body,
          url: payload.url,
        });
        notified++;
      } catch (error) {
        console.error("Push de recordatorio fallido:", error);
      }
    }

    if (prefs?.reminderEmail ?? false) {
      const sent = await sendEmail({
        to: user.email,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      if (sent) emails++;
    }
  }

  return NextResponse.json({
    ok: true,
    claimed: claimed.length,
    notified,
    emails,
  });
}