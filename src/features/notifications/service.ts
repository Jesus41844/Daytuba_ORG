import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { AppNotification } from "@/types";

export type CreateNotificationInput = {
  userId: string;
  type: AppNotification["type"];
  title: string;
  body?: string;
  url?: string;
  actorId?: string | null;
  actorName?: string;
};

export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  if (!input.userId) return;

  try {
    await db.insert(notifications).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      url: input.url ?? "",
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? "",
    });
  } catch (error) {
    console.error("No se pudo crear la notificación", error);
  }
}
