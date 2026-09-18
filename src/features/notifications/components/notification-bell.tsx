"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  CheckCheck,
  ClipboardList,
  Info,
  MessageSquare,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";
import {
  getNotifications,
  getUnreadNotificationCount,
} from "@/features/notifications/queries";
import {
  markAllNotificationsRead,
  markNotificationRead,
  processDueReminders,
} from "@/features/notifications/actions";

const POLL_INTERVAL_MS = 60_000;

const TYPE_ICONS: Record<AppNotification["type"], React.ElementType> = {
  invite: UserPlus,
  comment: MessageSquare,
  assignment: ClipboardList,
  reminder: BellRing,
  info: Info,
};

function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(value).toLocaleDateString("es-PA", {
    day: "numeric",
    month: "short",
  });
}

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const refreshCount = React.useCallback(async () => {
    try {
      setUnread(await getUnreadNotificationCount());
      void processDueReminders();
    } catch {
      // silencioso: la campana nunca debe romper la navegación
    }
  }, []);

  React.useEffect(() => {
    const initial = setTimeout(() => void refreshCount(), 0);
    const timer = setInterval(() => void refreshCount(), POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refreshCount]);

  async function loadItems() {
    setLoading(true);
    try {
      setItems(await getNotifications());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      void loadItems();
      void refreshCount();
    }
  }

  function handleItemClick(notification: AppNotification) {
    if (notification.readAt) return;
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) =>
        item.id === notification.id ? { ...item, readAt: now } : item
      )
    );
    setUnread((count) => Math.max(0, count - 1));
    void markNotificationRead(notification.id);
  }

  function handleMarkAll() {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => ({ ...item, readAt: item.readAt ?? now }))
    );
    setUnread(0);
    void markAllNotificationsRead();
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              unread > 0
                ? `Notificaciones, ${unread} sin leer`
                : "Notificaciones"
            }
            className={cn("relative", compact ? "size-9" : "size-9")}
          />
        }
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notificaciones</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              Marcar todas
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-96 overflow-y-auto p-1">
          {loading && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Cargando…
            </p>
          )}
          {!loading && items.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No tienes notificaciones
            </p>
          )}
          {!loading &&
            items.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] ?? Info;
              return (
                <DropdownMenuItem
                  key={notification.id}
                  render={
                    <Link href={notification.url || "/dashboard"} />
                  }
                  onClick={() => handleItemClick(notification)}
                  className={cn(
                    "items-start gap-2.5 px-2 py-2",
                    !notification.readAt && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                      notification.readAt
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/15 text-primary"
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-start gap-2">
                      <span className="line-clamp-2 flex-1 text-sm font-medium">
                        {notification.title}
                      </span>
                      {!notification.readAt && (
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    {notification.body && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {notification.body}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(notification.createdAt)}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
