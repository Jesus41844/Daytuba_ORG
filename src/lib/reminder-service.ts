import { and, eq, gte, inArray, isNotNull, isNull, lte, notInArray } from "drizzle-orm";

import { db } from "@/db";
import { createNotification } from "@/features/notifications/service";
import { sendEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/push";
import { buildReminderPayload, DUE_WINDOW_MS, getAppBaseUrl } from "@/lib/reminders";
import { notificationPreferences, tasks, users } from "@/db/schema";
import type { TaskStatus } from "@/types/task";

const COMPLETED_STATUSES: TaskStatus[] = ["completed", "cancelled"];

export type ReminderRunSummary = {
  claimed: number;
  notified: number;
  emails: number;
};

/**
 * Reclama de forma atómica las tareas con recordatorio vencido dentro de la
 * ventana (DUE_WINDOW_MS) que aún no se notificaron, y entrega in-app + push
 * + email según las preferencias de cada usuario.
 *
 * El `UPDATE ... RETURNING` con la condición `reminder_sent_at IS NULL`
 * garantiza que ningún run (cron diario o disparo por tráfico) envíe dos veces.
 */
export async function processDueReminderTasks(): Promise<ReminderRunSummary> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - DUE_WINDOW_MS);

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
    return { claimed: 0, notified: 0, emails: 0 };
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

  return { claimed: claimed.length, notified, emails };
}