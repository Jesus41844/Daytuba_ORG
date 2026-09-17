import { addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

const WEEKS = 8;

const STATUS_META: {
  key: TaskStatus;
  label: string;
  bar: string;
  dot: string;
}[] = [
  { key: "pending", label: "Pendientes", bar: "bg-yellow-400", dot: "bg-yellow-400" },
  { key: "in_progress", label: "En progreso", bar: "bg-blue-400", dot: "bg-blue-400" },
  { key: "review", label: "En revisión", bar: "bg-purple-400", dot: "bg-purple-400" },
  { key: "completed", label: "Completadas", bar: "bg-emerald-400", dot: "bg-emerald-400" },
  { key: "cancelled", label: "Canceladas", bar: "bg-muted-foreground/40", dot: "bg-muted-foreground/40" },
];

export function ProductivityPanel({ tasks }: { tasks: Task[] }) {
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });

  const weekly = Array.from({ length: WEEKS }, (_, index) => {
    const weekStart = subWeeks(thisWeekStart, WEEKS - 1 - index);
    const weekEnd = addWeeks(weekStart, 1);
    const count = tasks.filter((task) => {
      if (task.status !== "completed" || !task.completedAt) return false;
      const completed = new Date(task.completedAt);
      return completed >= weekStart && completed < weekEnd;
    }).length;
    return { weekStart, count };
  });

  const maxWeekly = Math.max(1, ...weekly.map((w) => w.count));

  const statusCounts = STATUS_META.map((meta) => ({
    ...meta,
    count: tasks.filter((task) => task.status === meta.key).length,
  }));
  const totalStatus = Math.max(
    1,
    statusCounts.reduce((sum, item) => sum + item.count, 0)
  );

  const considered = tasks.filter((t) => t.status !== "cancelled").length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const completionRate = considered === 0 ? 0 : Math.round((completed / considered) * 100);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Completadas por semana</CardTitle>
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="size-3.5" />
            últimas {WEEKS} semanas
          </span>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end justify-between gap-1.5 sm:gap-2">
            {weekly.map((week, index) => {
              const height = Math.round((week.count / maxWeekly) * 100);
              const isCurrent = index === weekly.length - 1;
              return (
                <div
                  key={week.weekStart.toISOString()}
                  className="flex flex-1 flex-col items-center justify-end gap-1.5"
                >
                  <span className="text-xs font-semibold tabular-nums">
                    {week.count > 0 ? week.count : ""}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all",
                      isCurrent ? "bg-primary" : "bg-primary/40"
                    )}
                    style={{ height: `${Math.max(week.count > 0 ? 6 : 2, height)}%` }}
                    title={`${week.count} completadas`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {format(week.weekStart, "d MMM", { locale: es })}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Distribución por estado</CardTitle>
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
            {completionRate}% finalizado
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {statusCounts.map((item) => {
            const pct = Math.round((item.count / totalStatus) * 100);
            return (
              <div key={item.key} className="flex items-center gap-3">
                <span className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-2 rounded-full", item.dot)} />
                  {item.label}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", item.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums">
                  {item.count}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
