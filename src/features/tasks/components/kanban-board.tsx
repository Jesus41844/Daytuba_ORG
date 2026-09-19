"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Category, Task, TaskStatus } from "@/types";
import { toast } from "@/components/ui/toast";
import { applyTaskStatusChange } from "@/lib/offline-queue";
import { KanbanCard } from "./kanban-card";

type KanbanBoardProps = {
  tasks: Task[];
  categories?: Category[];
};

const STATUS_COLUMNS: { value: TaskStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pendiente", color: "#64748b" },
  { value: "in_progress", label: "En progreso", color: "#0ea5e9" },
  { value: "review", label: "En revisión", color: "#f59e0b" },
  { value: "completed", label: "Completada", color: "#22c55e" },
  { value: "cancelled", label: "Cancelada", color: "#ef4444" },
];

export function KanbanBoard({ tasks, categories = [] }: KanbanBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, TaskStatus>
  >({});

  function clearOverride(taskId: string) {
    setStatusOverrides((prev) => {
      if (!(taskId in prev)) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  function effectiveStatus(task: Task): TaskStatus {
    return statusOverrides[task.id] ?? task.status;
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (dragOverStatus !== status) setDragOverStatus(status);
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    setDragOverStatus(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || effectiveStatus(task) === status) return;

    setError(null);
    setStatusOverrides((prev) => ({ ...prev, [taskId]: status }));

    startTransition(async () => {
      const outcome = await applyTaskStatusChange(task, status);
      if (outcome.outcome === "applied") {
        clearOverride(taskId);
        router.refresh();
      } else if (outcome.outcome === "queued") {
        toast.add({
          title: "Cambio guardado sin conexión",
          description: "Se sincronizará cuando vuelva la conexión.",
          type: "warning",
        });
      } else {
        clearOverride(taskId);
        setError(outcome.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STATUS_COLUMNS.map((column) => {
          const columnTasks = tasks.filter(
            (t) => effectiveStatus(t) === column.value
          );
          const isOver = dragOverStatus === column.value;

          return (
            <div
              key={column.value}
              onDragOver={(e) => handleDragOver(e, column.value)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverStatus(null);
                }
              }}
              onDrop={(e) => handleDrop(e, column.value)}
              className={cn(
                "flex w-72 shrink-0 flex-col gap-2 rounded-2xl bg-muted/40 p-2.5 transition-colors",
                isOver && "bg-primary/5 ring-2 ring-primary/40",
                isPending && "pointer-events-none opacity-60"
              )}
            >
              <div className="flex items-center gap-2 px-1.5 pt-1">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {column.label}
                </span>
                <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/50">
                  {columnTasks.length}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    categories={categories}
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}