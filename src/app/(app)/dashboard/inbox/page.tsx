import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { getInbox } from "@/features/inbox/queries";
import { InboxList } from "@/features/inbox/components/inbox-list";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Bandeja de Entrada | Daytuba Tasks",
};

export default async function InboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const tasks = await getInbox();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title="Bandeja de Entrada"
        description="Todas tus tareas pendientes ordenadas por prioridad y fecha."
      />
      {tasks.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No tienes tareas pendientes"
          description="Las tareas pendientes y prioritarias aparecerán aquí."
        />
      ) : (
        <InboxList tasks={tasks} />
      )}
    </div>
  );
}
