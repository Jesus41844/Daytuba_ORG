import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startOfWeek } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FolderOpen,
  ListTodo,
  Plus,
  Tag,
} from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { getUserTasks, getOverdueTasks } from "@/features/tasks/queries";
import { getUserCategories } from "@/features/categories/queries";
import { TaskCard } from "@/features/tasks/components/task-card";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard | Daytuba Tasks",
};

const QUICK_ACTIONS = [
  { label: "Nueva tarea", href: "/dashboard/tasks?create=true", icon: Plus },
  { label: "Proyectos", href: "/dashboard/projects", icon: FolderOpen },
  { label: "Categorías", href: "/dashboard/categories", icon: Tag },
  { label: "Calendario", href: "/dashboard/calendar", icon: CalendarDays },
];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [tasks, overdue, categories] = await Promise.all([
    getUserTasks(),
    getOverdueTasks().catch(() => []),
    getUserCategories(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const dueTodayCount = tasks.filter(
    (task) =>
      task.dueDate?.slice(0, 10) === today &&
      task.status !== "completed" &&
      task.status !== "cancelled"
  ).length;

  const completedThisWeekCount = tasks.filter(
    (task) =>
      task.status === "completed" &&
      task.completedAt &&
      new Date(task.completedAt).getTime() >= weekStart.getTime()
  ).length;

  const recentTasks = tasks.slice(0, 5);

  const stats = [
    {
      label: "Para hoy",
      value: dueTodayCount,
      icon: CalendarClock,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      borderColor: "ring-primary/50",
    },
    {
      label: "Vencidas",
      value: overdue.length,
      icon: AlertTriangle,
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
      borderColor: "ring-destructive/50",
    },
    {
      label: "Completadas esta semana",
      value: completedThisWeekCount,
      icon: CheckCircle2,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      borderColor: "ring-emerald-500/50",
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title="Dashboard"
        description={`Hola, ${session.displayName}. Este es el resumen de todas tus tareas.`}
      />

      <section
        aria-label="Resumen de tareas"
        className="grid grid-cols-3 gap-2 sm:gap-4"
      >
        {stats.map((stat) => (
          <Card key={stat.label} className={stat.borderColor}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
                {stat.label}
              </CardTitle>
              <div className={`flex size-8 items-center justify-center rounded-full ${stat.iconBg}`}>
                <stat.icon className={`size-4 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums sm:text-3xl">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-label="Acciones rápidas">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones rápidas</CardTitle>
            <CardDescription>
              Atajos para las tareas más comunes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.href}
                variant="secondary"
                size="sm"
                nativeButton={false}
                render={<Link href={action.href} />}
              >
                <action.icon data-icon="inline-start" />
                {action.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </section>

      {categories.length > 0 && (
        <section aria-label="Categorías">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Categorías</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/dashboard/tasks?category=${category.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: category.color + "18",
                    color: category.color,
                    borderWidth: "1px",
                    borderColor: category.color + "50",
                  }}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-label="Tareas recientes" className="space-y-3 sm:space-y-4">
        <h2 className="text-lg font-bold tracking-tight">Tareas recientes</h2>
        {recentTasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No hay tareas todavía"
            description="Crea tu primera tarea para empezar a organizar tu trabajo."
            action={
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/dashboard/tasks" />}
              >
                <Plus data-icon="inline-start" />
                Crear tarea
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {recentTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
