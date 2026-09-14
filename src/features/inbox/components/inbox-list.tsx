"use client";

import { useRouter } from "next/navigation";
import { format, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Task } from "@/types";

type InboxListProps = {
  tasks: Task[];
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent:
    "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400 ring-1 ring-red-200/50 dark:ring-red-500/20",
  high:
    "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 ring-1 ring-orange-200/50 dark:ring-orange-500/20",
  medium:
    "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400 ring-1 ring-yellow-200/50 dark:ring-yellow-500/20",
  low: "bg-muted text-muted-foreground ring-1 ring-border/50",
};

export function InboxList({ tasks }: InboxListProps) {
  const router = useRouter();

  if (tasks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Bandeja vacía</p>
          <p className="text-xs text-muted-foreground">
            No tienes tareas pendientes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col p-0">
        {tasks.map((task, index) => {
          const isOverdue =
            Boolean(task.dueDate) &&
            isBefore(new Date(task.dueDate!), startOfDay(new Date()));

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50",
                index > 0 && "border-t border-border/30"
              )}
            >
              <Badge
                variant="outline"
                className={PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low}
              >
                {task.priority}
              </Badge>

              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {task.title}
              </span>

              {task.dueDate && (
                <span
                  suppressHydrationWarning
                  className={cn(
                    "flex shrink-0 items-center gap-1 text-xs text-muted-foreground",
                    isOverdue && "font-medium text-destructive"
                  )}
                >
                  <CalendarIcon className="size-3" />
                  {format(new Date(task.dueDate), "d MMM yyyy", {
                    locale: es,
                  })}
                </span>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
