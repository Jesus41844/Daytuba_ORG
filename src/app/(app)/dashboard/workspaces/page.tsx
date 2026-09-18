import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getUserWorkspaces } from "@/features/workspaces/queries";
import { WorkspaceManager } from "@/features/workspaces/components/workspace-manager";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Espacios de trabajo | Daytuba Tasks",
};

export default async function WorkspacesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const workspaces = await getUserWorkspaces().catch(() => []);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title="Espacios de trabajo"
        description="Crea espacios con miembros y roles para compartir proyectos y tareas con tu equipo."
      />
      <WorkspaceManager
        initialWorkspaces={workspaces}
        currentUserId={session.uid}
      />
    </div>
  );
}