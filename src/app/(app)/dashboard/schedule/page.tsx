import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getUserSchedule } from "@/features/schedule/actions";
import { ScheduleManagerPage } from "@/features/schedule/components/schedule-manager-page";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Horario | Daytuba Tasks",
};

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const blocks = await getUserSchedule();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title="Horario"
        description="Gestiona tus bloques de clases e importa tu horario desde un PDF."
      />
      <ScheduleManagerPage initial={blocks} />
    </div>
  );
}