"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/components/ui/toast";
import { getTasksWithReminders } from "@/features/tasks/queries";
import type { Task } from "@/types";

const POLL_INTERVAL_MS = 60 * 1000;
const NOTIFIED_KEY = "utp:notified-reminders";

function loadNotifiedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function saveNotifiedIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]));
  } catch {
    // storage unavailable (private mode), ignore
  }
}

function showBrowserNotification(task: Task, onOpen: () => void) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const line = task.dueDate
    ? `Vence el ${format(new Date(task.dueDate), "d MMM yyyy", { locale: es })}`
    : task.description || "Tienes una tarea pendiente";

  try {
    const notification = new Notification(`🔔 ${task.title}`, {
      body: line,
      tag: `task-reminder-${task.id}`,
    });
    notification.onclick = () => {
      window.focus();
      onOpen();
      notification.close();
    };
  } catch {
    // fallback to toast only
  }
}

export function ReminderProvider() {
  const router = useRouter();
  const notifiedRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (notifiedRef.current) return;
    notifiedRef.current = loadNotifiedIds();

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    let cancelled = false;

    async function checkReminders() {
      try {
        const tasks = await getTasksWithReminders();
        if (cancelled) return;

        const now = Date.now();
        for (const task of tasks) {
          if (!task.reminderAt) continue;
          const reminderTime = new Date(task.reminderAt).getTime();
          if (reminderTime > now) continue;
          if (notifiedRef.current!.has(task.id)) continue;

          notifiedRef.current!.add(task.id);
          saveNotifiedIds(notifiedRef.current!);

          showBrowserNotification(task, () => {
            router.push(`/dashboard/tasks/${task.id}`);
          });
          toast.add({
            type: "info",
            title: `🔔 ${task.title}`,
            description: task.dueDate
              ? `Recordatorio: vence el ${format(new Date(task.dueDate), "d MMM yyyy 'a las' HH:mm", { locale: es })}`
              : "Recordatorio de tarea",
          });
        }
      } catch {
        // silent: polling errors must not disrupt the app
      }
    }

    void checkReminders();
    const interval = setInterval(() => void checkReminders(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  return null;
}