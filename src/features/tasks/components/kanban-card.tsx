"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Category, Task } from "@/types";

type KanbanCardProps = {
  task: Task;
  categories?: Category[];
  onDragStart: (e: React.DragEvent, task: Task) => void;
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

export function KanbanCard({
  task,
  categories = [],
  onDragStart,
}: KanbanCardProps) {
  const taskCategories = categories.filter((c) =>
    task.categories.includes(c.id)
  );

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      className="group flex cursor-grab flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:ring-1 hover:ring-primary/20 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
        <Link
          href={`/dashboard/tasks/${task.id}`}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="line-clamp-2 flex-1 text-sm font-medium leading-snug hover:text-primary"
        >
          {task.title}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-5.5">
        <Badge
          variant="outline"
          className={cn(
            "px-1.5 py-0 text-[10px]",
            PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low
          )}
        >
          {task.priority}
        </Badge>
        {taskCategories.slice(0, 3).map((category) => (
          <span
            key={category.id}
            title={category.name}
            className="size-2 rounded-full"
            style={{ backgroundColor: category.color }}
          />
        ))}
        {taskCategories.length > 3 && (
          <span className="text-[10px] text-muted-foreground">
            +{taskCategories.length - 3}
          </span>
        )}
      </div>

      {task.dueDate && (
        <span className="flex items-center gap-1 pl-5.5 text-[11px] text-muted-foreground">
          <CalendarIcon className="size-3" />
          {format(new Date(task.dueDate), "d MMM", { locale: es })}
        </span>
      )}
    </div>
  );
}