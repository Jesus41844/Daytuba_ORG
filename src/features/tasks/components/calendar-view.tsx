"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarHeader } from "./calendar-header";
import {
  CalendarFilters,
  EMPTY_CALENDAR_FILTERS,
  type CalendarFilterState,
} from "./calendar-filters";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import { EventDialog } from "@/features/events/components/event-dialog";
import type { Category, Project, Task } from "@/types";
import type { ScheduleBlock } from "@/features/schedule/types";
import type { CalendarEvent } from "@/features/events/types";
import { parseDateKey } from "../lib/calendar-utils";

type ViewMode = "day" | "week" | "month";

type CalendarViewProps = {
  tasks: Task[];
  scheduleBlocks: ScheduleBlock[];
  events: CalendarEvent[];
  projects: Project[];
  categories: Category[];
};

export function CalendarView({
  tasks,
  scheduleBlocks,
  events,
  projects,
  categories,
}: CalendarViewProps) {
  const searchParams = useSearchParams();

  const initialDate = useMemo(() => {
    const dateParam = searchParams.get("date");
    if (dateParam) return parseDateKey(dateParam);
    return new Date();
  }, [searchParams]);

  const [currentDate, setCurrentDate] = useState(initialDate);
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialDate, setDialogInitialDate] = useState<string | undefined>();
  const [dialogInitialStartTime, setDialogInitialStartTime] = useState<string | undefined>();
  const [dialogInitialEndTime, setDialogInitialEndTime] = useState<string | undefined>();
  const [dialogInitialDayOfWeek, setDialogInitialDayOfWeek] = useState<number | undefined>();
  const [dialogEditingEvent, setDialogEditingEvent] = useState<CalendarEvent | null>(null);

  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>(events);
  const [filters, setFilters] = useState<CalendarFilterState>(
    EMPTY_CALENDAR_FILTERS
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.projectId && task.projectId !== filters.projectId)
        return false;
      if (filters.categoryId && !task.categories.includes(filters.categoryId))
        return false;
      if (filters.from && (!task.dueDate || task.dueDate < filters.from))
        return false;
      if (filters.to && (!task.dueDate || task.dueDate > filters.to))
        return false;
      return true;
    });
  }, [tasks, filters]);

  const filteredEvents = useMemo(() => {
    if (!filters.from && !filters.to) return localEvents;
    return localEvents.filter((evt) => {
      if (evt.dayOfWeek !== null || !evt.date) return true;
      if (filters.from && evt.date < filters.from) return false;
      if (filters.to && evt.date > filters.to) return false;
      return true;
    });
  }, [localEvents, filters.from, filters.to]);

  const handlePrev = useCallback(() => {
    const next = new Date(currentDate);
    if (viewMode === "month") next.setMonth(next.getMonth() - 1);
    else if (viewMode === "week") next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  }, [currentDate, viewMode]);

  const handleNext = useCallback(() => {
    const next = new Date(currentDate);
    if (viewMode === "month") next.setMonth(next.getMonth() + 1);
    else if (viewMode === "week") next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  }, [currentDate, viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  function openSlotDialog(date: Date, startTime: string) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = parseInt(startTime.split(":")[0] ?? "0", 10);
    const endH = String(Math.min(h + 1, 23)).padStart(2, "0");
    const endM = startTime.split(":")[1] ?? "00";

    setDialogInitialDate(`${y}-${m}-${d}`);
    setDialogInitialStartTime(startTime);
    setDialogInitialEndTime(`${endH}:${endM}`);
    setDialogInitialDayOfWeek(undefined);
    setDialogEditingEvent(null);
    setDialogOpen(true);
  }

  function openDayDialog(date: Date) {
    const dow = date.getDay();
    setDialogInitialDate(undefined);
    setDialogInitialStartTime("09:00");
    setDialogInitialEndTime("10:00");
    setDialogInitialDayOfWeek(dow);
    setDialogEditingEvent(null);
    setDialogOpen(true);
  }

  function handleEventClick(evt: CalendarEvent) {
    setDialogEditingEvent(evt);
    setDialogOpen(true);
  }

  function handleEventSaved(evt: CalendarEvent) {
    setLocalEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === evt.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = evt;
        return next;
      }
      return [...prev, evt];
    });
  }

  function handleEventDeleted(id: string) {
    setLocalEvents((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={setViewMode}
      />

      <CalendarFilters
        filters={filters}
        onChange={setFilters}
        projects={projects}
        categories={categories}
        matchCount={filteredTasks.length}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === "month" && (
          <MonthView
            currentDate={currentDate}
            tasks={filteredTasks}
            scheduleBlocks={scheduleBlocks}
            events={filteredEvents}
            onDayClick={(d) => openDayDialog(d)}
            onEventClick={handleEventClick}
          />
        )}
        {viewMode === "week" && (
          <WeekView
            currentDate={currentDate}
            tasks={filteredTasks}
            scheduleBlocks={scheduleBlocks}
            events={filteredEvents}
            onSlotClick={(d, t) => openSlotDialog(d, t)}
            onEventClick={handleEventClick}
          />
        )}
        {viewMode === "day" && (
          <DayView
            currentDate={currentDate}
            tasks={filteredTasks}
            scheduleBlocks={scheduleBlocks}
            events={filteredEvents}
            onSlotClick={(d, t) => openSlotDialog(d, t)}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      <EventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handleEventSaved}
        onDeleted={handleEventDeleted}
        initialDate={dialogInitialDate}
        initialStartTime={dialogInitialStartTime}
        initialEndTime={dialogInitialEndTime}
        initialDayOfWeek={dialogInitialDayOfWeek}
        editingEvent={dialogEditingEvent}
      />
    </div>
  );
}
