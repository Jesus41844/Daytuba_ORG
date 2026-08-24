import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { getUserTasks, type TaskFilters } from "@/features/tasks/queries";
import { getUserProjects } from "@/features/projects/queries";
import { getUserCategories } from "@/features/categories/queries";
import { TaskList } from "@/features/tasks/components/task-list";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tareas | Daytuba Tasks",
};

const STATUS_FILTERS = [
  { value: "", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "in_progress", label: "En progreso" },
  { value: "review", label: "En revisión" },
  { value: "completed", label: "Completadas" },
] as const;

const PRIORITY_FILTERS = [
  { value: "", label: "Todas" },
  { value: "urgent", label: "Urgente" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
] as const;

type SearchParams = Promise<{
  status?: string;
  priority?: string;
  category?: string;
  create?: string;
}>;

function buildHref(
  status: string,
  priority: string,
  category: string
) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `/dashboard/tasks?${qs}` : "/dashboard/tasks";
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { status, priority, category, create } = await searchParams;

  const validStatus = STATUS_FILTERS.some((f) => f.value === status)
    ? (status as NonNullable<TaskFilters["status"]>)
    : undefined;
  const validPriority = PRIORITY_FILTERS.some((f) => f.value === priority)
    ? (priority as NonNullable<TaskFilters["priority"]>)
    : undefined;

  const [tasks, projects, categories] = await Promise.all([
    getUserTasks({
      status: validStatus,
      priority: validPriority,
      categoryId: category,
    }),
    getUserProjects(),
    getUserCategories(),
  ]);

  const activeStatus = validStatus ?? "";
  const activePriority = validPriority ?? "";
  const activeCategory = category ?? "";

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Tareas"
          description="Todas tus tareas, organizadas por estado y prioridad."
        />
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/tasks/archived" />}
        >
          <Archive data-icon="inline-start" />
          Archivadas
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-muted/40 p-3 sm:p-4">
        {/* Status filter */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estado
          </span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => {
              const isActive = filter.value === activeStatus;
              const href = buildHref(
                filter.value,
                activePriority,
                activeCategory
              );
              return (
                <Link
                  key={filter.label}
                  href={href}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-background text-muted-foreground hover:bg-muted ring-1 ring-border/50"
                  )}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Priority filter */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Prioridad
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITY_FILTERS.map((filter) => {
              const isActive = filter.value === activePriority;
              const href = buildHref(
                activeStatus,
                filter.value,
                activeCategory
              );
              return (
                <Link
                  key={filter.label}
                  href={href}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-background text-muted-foreground hover:bg-muted ring-1 ring-border/50"
                  )}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Categorías
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={buildHref(activeStatus, activePriority, "")}
                aria-current={!activeCategory ? "true" : undefined}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  !activeCategory
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background text-muted-foreground hover:bg-muted ring-1 ring-border/50"
                )}
              >
                Todas
              </Link>
              {categories.map((c) => {
                const isActive = c.id === activeCategory;
                return (
                  <Link
                    key={c.id}
                    href={buildHref(activeStatus, activePriority, c.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      isActive
                        ? "text-white shadow-sm"
                        : "bg-background text-muted-foreground hover:bg-muted ring-1 ring-border/50"
                    )}
                    style={
                      isActive
                        ? { backgroundColor: c.color }
                        : undefined
                    }
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <TaskList tasks={tasks} projects={projects} categories={categories} autoOpen={create === "true"} />
    </div>
  );
}
