import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { getProjectsByWorkspace } from "@/features/projects/queries";
import { getUserTasks } from "@/features/tasks/queries";
import { getUserWorkspaces } from "@/features/workspaces/queries";
import { ProjectList } from "@/features/projects/components/project-list";
import { WorkspaceFilter } from "@/features/workspaces/components/workspace-filter";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Proyectos | Daytuba Tasks",
};

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const activeWorkspaceId = await getActiveWorkspaceId();
  const workspaceList = await getUserWorkspaces().catch(() => []);

  const activeWorkspace = activeWorkspaceId
    ? workspaceList.find((entry) => entry.workspace.id === activeWorkspaceId)
    : undefined;


  const [projects, tasks] = await Promise.all([
    getProjectsByWorkspace(activeWorkspaceId).catch(() => []),
    getUserTasks({ workspaceId: activeWorkspaceId }),
  ]);

  const role = activeWorkspace?.role ?? null;
  const canReadWrite =
    role === null || role === "admin" || role === "member";

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title={
          activeWorkspace ? activeWorkspace.workspace.name : "Proyectos"
        }
        description={
          activeWorkspace
            ? "Proyectos y tareas del espacio de trabajo."
            : "Organiza tus tareas en proyectos o fases de trabajo."
        }
      />
      <WorkspaceFilter
        workspaces={workspaceList.map(({ workspace, role: wsRole }) => ({
          id: workspace.id,
          name: workspace.name,
          color: workspace.color,
          role: wsRole,
        }))}
        activeWorkspaceId={activeWorkspaceId}
      />
      <ProjectList
        projects={projects}
        tasks={tasks}
        currentUserId={session.uid}
        workspaceId={activeWorkspaceId}
        canManageWorkspace={canReadWrite}
      />
    </div>
  );
}
