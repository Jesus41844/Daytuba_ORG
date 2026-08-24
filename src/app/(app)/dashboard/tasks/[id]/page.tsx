import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Tag } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { getTaskById } from "@/features/tasks/queries";
import { getUserProjects } from "@/features/projects/queries";
import { getUserCategories, getTaskCategories } from "@/features/categories/queries";
import { EditTaskForm } from "@/features/tasks/components/edit-task-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Tarea | Daytuba Tasks" };
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  review: "En revisión",
  completed: "Completada",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  review: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  low: "bg-muted text-muted-foreground",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const task = await getTaskById(id);
  if (!task) notFound();

  const [projects, allCategories, taskCategories] = await Promise.all([
    getUserProjects(),
    getUserCategories(),
    getTaskCategories(id),
  ]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link href="/dashboard/tasks" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader title={task.title} className="flex-1" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EditTaskForm
            task={task}
            projects={projects}
            allCategories={allCategories}
            taskCategories={taskCategories}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge
                  className={cn(
                    "border-transparent",
                    STATUS_COLORS[task.status]
                  )}
                >
                  {STATUS_LABELS[task.status] ?? task.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Prioridad</span>
                <Badge
                  className={cn(
                    "border-transparent",
                    PRIORITY_STYLES[task.priority]
                  )}
                >
                  {PRIORITY_LABELS[task.priority] ?? task.priority}
                </Badge>
              </div>
              {task.dueDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" />
                    Vencimiento
                  </span>
                  <span className="font-medium">
                    {new Date(task.dueDate).toLocaleDateString("es-PE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {task.startDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Inicio</span>
                  <span className="font-medium">
                    {new Date(task.startDate).toLocaleDateString("es-PE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {taskCategories.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Tag className="size-3.5" />
                  Categorías
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {taskCategories.map((category) => (
                  <Badge
                    key={category.id}
                    variant="outline"
                    className="border-transparent"
                    style={{
                      backgroundColor: category.color + "25",
                      color: category.color,
                    }}
                  >
                    {category.name}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
