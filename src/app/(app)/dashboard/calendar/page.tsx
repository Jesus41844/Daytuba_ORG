import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getTasksForCalendar } from "@/features/tasks/queries";
import { getUserProjects } from "@/features/projects/queries";
import { getUserCategories } from "@/features/categories/queries";
import { getUserSchedule } from "@/features/schedule/actions";
import { getUserEvents } from "@/features/events/actions";
import { CalendarView } from "@/features/tasks/components/calendar-view";

export const metadata: Metadata = {
  title: "Calendario | Daytuba Tasks",
};

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [tasks, projects, categories, scheduleBlocks, events] =
    await Promise.all([
      getTasksForCalendar(),
      getUserProjects(),
      getUserCategories(),
      getUserSchedule(),
      getUserEvents(),
    ]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <CalendarView
        tasks={tasks}
        projects={projects}
        categories={categories}
        scheduleBlocks={scheduleBlocks}
        events={events}
      />
    </div>
  );
}
