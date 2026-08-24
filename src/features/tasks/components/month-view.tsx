"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";
import type { ScheduleBlock } from "@/features/schedule/types";
import type { CalendarEvent } from "@/features/events/types";
import { DAY_NAMES_SHORT } from "@/features/schedule/types";
import { localDateKey, isToday, PRIORITY_ORDER } from "../lib/calendar-utils";

const PRIORITY_COLORS: Record<Task["priority"], string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-blue-500",
  low: "bg-muted-foreground/30",
};

type MonthViewProps = {
  currentDate: Date;
  tasks: Task[];
  scheduleBlocks: ScheduleBlock[];
  events: CalendarEvent[];
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
};

type CellData = {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  today: boolean;
  tasks: Task[];
  scheduleBlocks: ScheduleBlock[];
  events: CalendarEvent[];
};

const MAX_VISIBLE = 3;

export function MonthView({
  currentDate,
  tasks,
  scheduleBlocks,
  events,
  onDayClick,
  onEventClick,
}: MonthViewProps) {
  const router = useRouter();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const cells = useMemo((): CellData[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay();
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDow);

    const taskMap = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const k = t.dueDate.slice(0, 10);
      const arr = taskMap.get(k);
      if (arr) arr.push(t);
      else taskMap.set(k, [t]);
    }

    const scheduleMap = new Map<number, ScheduleBlock[]>();
    for (const b of scheduleBlocks) {
      const arr = scheduleMap.get(b.dayOfWeek);
      if (arr) arr.push(b);
      else scheduleMap.set(b.dayOfWeek, [b]);
    }

    const eventMapByDate = new Map<string, CalendarEvent[]>();
    const eventMapByDow = new Map<number, CalendarEvent[]>();
    for (const e of events) {
      if (e.date) {
        const arr = eventMapByDate.get(e.date);
        if (arr) arr.push(e);
        else eventMapByDate.set(e.date, [e]);
      } else if (e.dayOfWeek !== null) {
        const arr = eventMapByDow.get(e.dayOfWeek);
        if (arr) arr.push(e);
        else eventMapByDow.set(e.dayOfWeek, [e]);
      }
    }

    const result: CellData[] = [];
    const cursor = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      const k = localDateKey(cursor);
      const dow = cursor.getDay();
      const dayEvents = [
        ...(eventMapByDate.get(k) ?? []),
        ...(eventMapByDow.get(dow) ?? []),
      ].sort((a, b) => a.startTime.localeCompare(b.startTime));

      result.push({
        date: new Date(cursor),
        key: k,
        isCurrentMonth: cursor.getMonth() === month,
        isWeekend: dow === 0 || dow === 6,
        today: isToday(cursor),
        tasks: (taskMap.get(k) ?? []).sort(
          (a, b) =>
            (PRIORITY_ORDER[a.priority] ?? 4) -
            (PRIORITY_ORDER[b.priority] ?? 4)
        ),
        scheduleBlocks: scheduleMap.get(dow) ?? [],
        events: dayEvents,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [currentDate, tasks, scheduleBlocks, events]);

  const weeks = useMemo(() => {
    const result: CellData[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [cells]);

  function handleDayClick(date: Date) {
    if (onDayClick) onDayClick(date);
    else {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      router.push(`/dashboard/calendar?date=${y}-${m}-${d}`);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-7 border-b border-border/40">
        {DAY_NAMES_SHORT.map((name, i) => (
          <div
            key={name}
            className={cn(
              "py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider",
              i === 0 || i === 6
                ? "text-muted-foreground/60"
                : "text-muted-foreground"
            )}
          >
            {name}
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-rows-[repeat(auto-fill,1fr)]">
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 border-b border-border/40 last:border-b-0"
          >
            {week.map((cell) => {
              const isExpanded = expandedDay === cell.key;
              const allItems = [
                ...cell.events.map((e) => ({ type: "event" as const, data: e })),
                ...cell.tasks.map((t) => ({ type: "task" as const, data: t })),
              ];
              const visible = isExpanded ? allItems : allItems.slice(0, MAX_VISIBLE);
              const hiddenCount = allItems.length - MAX_VISIBLE;

              return (
                <div
                  key={cell.key}
                  className={cn(
                    "relative flex flex-col border-r border-border/40 last:border-r-0 min-h-0 overflow-hidden transition-colors",
                    !cell.isCurrentMonth && "bg-muted/20",
                    cell.isWeekend && cell.isCurrentMonth && "bg-muted/[0.15]",
                    cell.today && "bg-primary/[0.04]"
                  )}
                >
                  <button
                    onClick={() => handleDayClick(cell.date)}
                    className="flex items-start justify-between px-1.5 pt-1 pb-0.5"
                  >
                    <span />
                    <span
                      className={cn(
                        "inline-flex items-center justify-center text-xs font-medium w-7 h-7 rounded-full transition-colors",
                        cell.today
                          ? "bg-primary text-primary-foreground font-bold"
                          : cell.isCurrentMonth
                            ? "text-foreground/80 hover:bg-muted"
                            : "text-muted-foreground/50"
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                  </button>

                  <div className="flex-1 flex flex-col gap-px px-1 pb-1 min-h-0 overflow-hidden">
                    {visible.map((item) =>
                      item.type === "event" ? (
                        <button
                          key={`e-${item.data.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(item.data);
                          }}
                          className="flex items-center rounded-md px-1.5 py-0.5 min-w-0 text-left transition-opacity hover:opacity-80"
                          style={{ backgroundColor: item.data.color }}
                        >
                          <span className="text-[11px] font-medium leading-tight truncate text-white">
                            {item.data.title}
                          </span>
                        </button>
                      ) : (
                        <div
                          key={`t-${item.data.id}`}
                          className={cn(
                            "flex items-center rounded-md px-1.5 py-0.5 min-w-0",
                            PRIORITY_COLORS[item.data.priority]
                          )}
                        >
                          <span
                            className={cn(
                              "text-[11px] font-medium leading-tight truncate",
                              item.data.priority === "low"
                                ? "text-foreground/70"
                                : "text-white"
                            )}
                          >
                            {item.data.title}
                          </span>
                        </div>
                      )
                    )}

                    {!isExpanded && hiddenCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDay(cell.key);
                        }}
                        className="text-[11px] font-medium text-primary hover:text-primary/80 px-1 py-0.5 text-left rounded hover:bg-primary/5 transition-colors"
                      >
                        +{hiddenCount} más
                      </button>
                    )}
                    {isExpanded && allItems.length > MAX_VISIBLE && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDay(null);
                        }}
                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-1 py-0.5 text-left rounded hover:bg-muted transition-colors"
                      >
                        Menos
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
