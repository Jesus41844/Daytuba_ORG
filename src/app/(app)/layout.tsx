import * as React from "react";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { ToasterWrapper } from "@/components/providers/toaster-wrapper";
import { ReminderProvider } from "@/components/providers/reminder-provider";
import { SidebarWidthUpdater } from "@/components/layout/sidebar-width-updater";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/clear-session");

  return (
    <SidebarProvider>
      <SidebarWidthUpdater />
      <div className="min-h-svh">
        <Sidebar user={session} />
        <div className="flex min-h-svh flex-col max-lg:pl-0 lg:pl-(--sidebar-width)">
          <main className="w-full flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
            {children}
          </main>
        </div>
        <ToasterWrapper />
        <ReminderProvider />
      </div>
    </SidebarProvider>
  );
}
