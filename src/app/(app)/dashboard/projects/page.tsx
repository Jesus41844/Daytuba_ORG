import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getUserProjects } from "@/features/projects/queries";
import { getUserTasks } from "@/features/tasks/queries";
import { ProjectList } from "@/features/projects/components/project-list";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Proyectos | Daytuba Tasks",
};

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [projects, tasks] = await Promise.all([
    getUserProjects().catch(() => []),
    getUserTasks(),
  ]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title="Proyectos"
        description="Organiza tus tareas en proyectos o fases de trabajo."
      />
      <ProjectList projects={projects} tasks={tasks} />
    </div>
  );
}
