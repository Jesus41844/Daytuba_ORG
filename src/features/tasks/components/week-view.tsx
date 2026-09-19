"use client";

import { useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";
import type { ScheduleBlock } from "@/features/schedule/types";
import type { CalendarEvent } from "@/features/events/types";
import { DAY_NAMES_SHORT } from "@/features/schedule/types";
import {
  formatTime,
  localDateKey,
  isToday,
  timeToMinutes,
  minutesToPixels,
  HOUR_HEIGHT,
  HOURS,
} from "../lib/calendar-utils";

type WeekViewProps = {
  currentDate: Date;
  tasks: Task[];
  scheduleBlocks: ScheduleBlock[];
  events: CalendarEvent[];
  onDayClick?: (date: Date) => void;
  onSlotClick?: (date: Date, startTime: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
};

const PRIORITY_COLORS: Record<Task["priority"], string> = {
  urgent: "bg-red-500/90 text-white",
  high: "bg-orange-400/90 text-white",
  medium: "bg-blue-500/90 text-white",
  low: "bg-muted-foreground/30 text-foreground",
};

function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function snapToSlot(minutes: number): number {
  return Math.round(minutes / 30) * 30;
}

export function WeekView({
  currentDate,
  tasks,
  scheduleBlocks,
  events,
  onDayClick,
  onSlotClick,
  onEventClick,
}: WeekViewProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = minutesToPixels(minutes, HOUR_HEIGHT);
    const container = scrollRef.current;
    const containerHeight = container.clientHeight;
    const scrollTop = top - containerHeight / 2;
    container.scrollTop = Math.max(0, scrollTop);
  }, []);

  const dayColumns = useMemo(() => {
    return weekDates.map((date) => {
      const dow = date.getDay();
      const key = localDateKey(date);

      const daySchedule = scheduleBlocks
        .filter((b) => b.dayOfWeek === dow)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      const dayTasks = tasks
        .filter((t) => t.dueDate?.slice(0, 10) === key)
        .sort((a, b) => {
          const pa = a.priority === "urgent" ? 0 : a.priority === "high" ? 1 : a.priority === "medium" ? 2 : 3;
          const pb = b.priority === "urgent" ? 0 : b.priority === "high" ? 1 : b.priority === "medium" ? 2 : 3;
          return pa - pb;
        });

      const dayEvents = events
        .filter((e) => {
          if (e.date) return e.date === key;
          if (e.dayOfWeek !== null) return e.dayOfWeek === dow;
          return false;
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      return { date, key, daySchedule, dayTasks, dayEvents };
    });
  }, [weekDates, tasks, scheduleBlocks, events]);

  const handleSlotClick = useCallback(
    (date: Date, hour: number) => {
      if (!onSlotClick) return;
      const snapped = snapToSlot(hour * 60);
      const h = String(Math.floor(snapped / 60)).padStart(2, "0");
      const m = String(snapped % 60).padStart(2, "0");
      onSlotClick(date, `${h}:${m}`);
    },
    [onSlotClick]
  );

  const contentHeight = HOURS.length * HOUR_HEIGHT;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-[4rem_1fr] border-b border-border/50 shrink-0">
        <div />
        <div className="grid grid-cols-7">
          {dayColumns.map((col) => (
            <button
              key={col.key}
              onClick={() => {
                if (onDayClick) onDayClick(col.date);
                else router.push(`/dashboard/calendar?date=${col.key}`);
              }}
              className="flex flex-col items-center py-2 border-l border-border/50 transition-colors hover:bg-muted/50"
            >
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                {DAY_NAMES_SHORT[col.date.getDay()]}
              </span>
              <span
                className={cn(
                  "mt-0.5 flex items-center justify-center text-sm font-medium w-8 h-8 rounded-full",
                  isToday(col.date) && "bg-primary text-primary-foreground font-bold"
                )}
              >
                {col.date.getDate()}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <div className="grid grid-cols-[4rem_1fr] min-h-0" style={{ height: contentHeight }}>
          <div className="relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {hour === 0 ? "" : formatTime(`${String(hour).padStart(2, "0")}:00`)}
              </div>
            ))}
          </div>

          <div className="relative grid grid-cols-7 min-h-0">
            {dayColumns.map((col) => (
              <div
                key={col.key}
                className={cn(
                  "relative border-l border-border/50",
                  isToday(col.date) && "bg-primary/[0.03]"
                )}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => handleSlotClick(col.date, hour)}
                  />
                ))}

                {col.daySchedule.map((block) => {
                  const startMin = timeToMinutes(block.startTime);
                  const endMin = timeToMinutes(block.endTime);
                  const top = minutesToPixels(startMin, HOUR_HEIGHT);
                  const height = Math.max(minutesToPixels(endMin - startMin, HOUR_HEIGHT), 24);

                  return (
                    <div
                      key={block.id}
                      className="absolute left-0.5 right-1 rounded-md px-1.5 py-1 overflow-hidden border border-transparent hover:border-foreground/20 transition-colors"
                      style={{ top, height, backgroundColor: block.color + "cc", color: "white" }}
                      title={`${block.name} (${formatTime(block.startTime)} – ${formatTime(block.endTime)})`}
                    >
                      <p className="text-[11px] font-medium leading-tight truncate">
                        {block.name}
                      </p>
                      {height > 32 && (
                        <p className="text-[10px] leading-tight opacity-90">
                          {formatTime(block.startTime)} – {formatTime(block.endTime)}
                        </p>
                      )}
                    </div>
                  );
                })}

                {col.dayEvents.map((evt) => {
                  const startMin = timeToMinutes(evt.startTime);
                  const endMin = timeToMinutes(evt.endTime);
                  const top = minutesToPixels(startMin, HOUR_HEIGHT);
                  const height = Math.max(minutesToPixels(endMin - startMin, HOUR_HEIGHT), 24);

                  return (
                    <div
                      key={evt.id}
                      className="absolute left-0.5 right-1 rounded-md px-1.5 py-1 overflow-hidden border border-transparent hover:border-foreground/20 transition-colors cursor-pointer"
                      style={{ top, height, backgroundColor: evt.color + "cc", color: "white" }}
                      title={`${evt.title} (${formatTime(evt.startTime)} – ${formatTime(evt.endTime)})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(evt);
                      }}
                    >
                      <p className="text-[11px] font-medium leading-tight truncate">
                        {evt.title}
                      </p>
                      {height > 32 && (
                        <p className="text-[10px] leading-tight opacity-90">
                          {formatTime(evt.startTime)} – {formatTime(evt.endTime)}
                        </p>
                      )}
                    </div>
                  );
                })}

                {col.dayTasks.slice(0, 3).map((task, i) => {
                  const baseHour = 7;
                  const top = (baseHour + i) * HOUR_HEIGHT + 8;

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "absolute left-0.5 right-1 rounded-md px-1.5 py-1 overflow-hidden border border-transparent hover:border-foreground/20 transition-colors",
                        PRIORITY_COLORS[task.priority]
                      )}
                      style={{ top, height: 28 }}
                      title={task.title}
                    >
                      <p className="text-[11px] font-medium leading-tight truncate">
                        {task.title}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}

            {(() => {
              const now = new Date();
              const minutes = now.getHours() * 60 + now.getMinutes();
              const top = minutesToPixels(minutes, HOUR_HEIGHT);
              const currentDow = now.getDay();
              const colIndex = dayColumns.findIndex(
                (c) => c.date.getDay() === currentDow
              );
              if (colIndex === -1) return null;
              const colPercent = (colIndex / 7) * 100;
              return (
                <div
                  className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                  style={{ top }}
                >
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-primary -translate-x-1/2"
                    style={{ left: `${colPercent}%` }}
                  />
                  <div className="absolute left-0 right-0 h-px bg-primary" />
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
