"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Archive, BellRing, CalendarIcon, Ellipsis, Pencil, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { applyTaskStatusChange } from "@/lib/offline-queue";
import { deleteTask, updateTask } from "../actions";
import type { Task, Category } from "@/types";

type TaskCardProps = {
  task: Task;
  categories?: Category[];
  onEdit?: (id: string) => void;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  review: "En revisión",
  completed: "Completada",
  cancelled: "Cancelada",
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

export function TaskCard({ task, categories = [], onEdit }: TaskCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<Task["status"] | null>(null);
  const status = localStatus ?? task.status;

  const href = `/dashboard/tasks/${task.id}`;
  const isOverdue =
    Boolean(task.dueDate) &&
    status !== "completed" &&
    status !== "cancelled" &&
    isBefore(new Date(task.dueDate!), startOfDay(new Date()));

  function handleToggleComplete() {
    const newStatus = status === "completed" ? "pending" : "completed";
    setLocalStatus(newStatus);

    startTransition(async () => {
      const outcome = await applyTaskStatusChange(task, newStatus);
      if (outcome.outcome === "applied") {
        setLocalStatus(null);
        router.refresh();
      } else if (outcome.outcome === "queued") {
        toast.add({
          title: "Cambio guardado sin conexión",
          description: "Se sincronizará cuando vuelva la conexión.",
          type: "warning",
        });
      } else {
        setLocalStatus(null);
        toast.add({
          title: "No se pudo actualizar la tarea",
          description: outcome.message,
          type: "error",
        });
      }
    });
  }

  function handleArchive() {
    startTransition(async () => {
      await updateTask(task.id, { isArchived: true });
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteTask(task.id);
      router.refresh();
    });
  }

  return (
    <Card className="group relative gap-2 py-3 transition-colors hover:ring-primary/20">
      <Link
        href={href}
        aria-label={task.title}
        className="absolute inset-0 rounded-2xl"
      />
      <CardContent className="flex flex-col gap-2 px-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low}
            >
              {task.priority}
            </Badge>
            <Badge variant="secondary">{STATUS_LABELS[status] ?? status}</Badge>
            {categories.map((category) => (
              <Badge
                key={category.id}
                variant="outline"
                className="border-transparent"
                style={{ backgroundColor: category.color + "25", color: category.color }}
              >
                {category.name}
              </Badge>
            ))}
          </div>
          <div className="relative z-10 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={isPending}
              aria-label={status === "completed" ? "Desmarcar como completada" : "Marcar como completada"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleToggleComplete();
              }}
            >
              <div
                className={cn(
                  "size-4 rounded-full border-2 transition-colors",
                  status === "completed"
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/50"
                )}
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={isPending}
                    aria-label="Opciones de tarea"
                  >
                    <Ellipsis className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    onEdit ? onEdit(task.id) : router.push(href)
                  }
                >
                  <Pencil />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive />
                  Archivar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                  <Trash2 />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <h3 className="line-clamp-2 text-sm font-medium leading-snug">
          {task.title}
        </h3>

        {task.assigneeName && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="size-3" />
            {task.assigneeName}
          </span>
        )}

        {task.dueDate && (
          <span
            suppressHydrationWarning
            className={cn(
              "flex items-center gap-1 text-xs text-muted-foreground",
              isOverdue && "font-medium text-destructive"
            )}
          >
            <CalendarIcon className="size-3" />
            {format(new Date(task.dueDate), "d MMM yyyy", { locale: es })}
          </span>
        )}

        {task.reminderAt &&
          status !== "completed" &&
          status !== "cancelled" && (
            <span
              suppressHydrationWarning
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <BellRing className="size-3" />
              {format(new Date(task.reminderAt), "d MMM yyyy HH:mm", {
                locale: es,
              })}
            </span>
          )}
      </CardContent>
    </Card>
  );
}
