import * as React from "react";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getSharedProjects } from "@/features/projects/queries";
import { getUserWorkspaces } from "@/features/workspaces/queries";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { ToasterWrapper } from "@/components/providers/toaster-wrapper";
import { PushProvider } from "@/components/providers/push-provider";
import { PwaProvider } from "@/components/providers/pwa-provider";
import { BadgeProvider } from "@/components/providers/badge-provider";
import { OfflineSyncProvider } from "@/components/providers/offline-sync-provider";
import { SidebarWidthUpdater } from "@/components/layout/sidebar-width-updater";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/clear-session");

  const sharedProjects = await getSharedProjects();
  const workspaces = await getUserWorkspaces().catch(() => []);

  return (
    <SidebarProvider>
      <SidebarWidthUpdater />
      <div className="min-h-svh">
        <Sidebar
          user={session}
          sharedProjects={sharedProjects}
          workspaces={workspaces.map(({ workspace, role }) => ({
            id: workspace.id,
            name: workspace.name,
            color: workspace.color,
            role,
          }))}
        />
        <div className="flex min-h-svh flex-col max-lg:pl-0 lg:pl-(--sidebar-width)">
          <main className="w-full flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
            {children}
          </main>
        </div>
        <ToasterWrapper />
        <PushProvider />
        <PwaProvider />
        <BadgeProvider />
        <OfflineSyncProvider />
      </div>
    </SidebarProvider>
  );
}
