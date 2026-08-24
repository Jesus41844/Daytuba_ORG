import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowLeft } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { getArchivedTasks } from "@/features/tasks/queries";
import { TaskCard } from "@/features/tasks/components/task-card";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Tareas archivadas | Daytuba Tasks",
};

export default async function ArchivedTasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const tasks = await getArchivedTasks();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link href="/dashboard/tasks" />}
          aria-label="Volver a tareas"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          title="Tareas archivadas"
          description={`${tasks.length} tarea${tasks.length !== 1 ? "s" : ""} archivada${tasks.length !== 1 ? "s" : ""}.`}
        />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="No hay tareas archivadas"
          description="Las tareas que archives aparecerán aquí."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
