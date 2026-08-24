"use client";

import { useMemo, useCallback } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";
import type { ScheduleBlock } from "@/features/schedule/types";
import type { CalendarEvent } from "@/features/events/types";
import {
  formatTime,
  localDateKey,
  isToday,
  timeToMinutes,
  minutesToPixels,
  HOUR_HEIGHT,
  HOURS,
} from "../lib/calendar-utils";

type DayViewProps = {
  currentDate: Date;
  tasks: Task[];
  scheduleBlocks: ScheduleBlock[];
  events: CalendarEvent[];
  onSlotClick?: (date: Date, startTime: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
};

function snapToSlot(minutes: number): number {
  return Math.round(minutes / 30) * 30;
}

export function DayView({
  currentDate,
  tasks,
  scheduleBlocks,
  events,
  onSlotClick,
  onEventClick,
}: DayViewProps) {
  const dow = currentDate.getDay();
  const key = localDateKey(currentDate);

  const daySchedule = useMemo(
    () =>
      scheduleBlocks
        .filter((b) => b.dayOfWeek === dow)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [scheduleBlocks, dow]
  );

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => {
          if (e.date) return e.date === key;
          if (e.dayOfWeek !== null) return e.dayOfWeek === dow;
          return false;
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, dow, key]
  );

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate?.slice(0, 10) === key)
        .sort((a, b) => {
          const pa = a.priority === "urgent" ? 0 : a.priority === "high" ? 1 : a.priority === "medium" ? 2 : 3;
          const pb = b.priority === "urgent" ? 0 : b.priority === "high" ? 1 : b.priority === "medium" ? 2 : 3;
          return pa - pb;
        }),
    [tasks, key]
  );

  const handleSlotClick = useCallback(
    (hour: number) => {
      if (!onSlotClick) return;
      const snapped = snapToSlot(hour * 60);
      const h = String(Math.floor(snapped / 60)).padStart(2, "0");
      const m = String(snapped % 60).padStart(2, "0");
      onSlotClick(currentDate, `${h}:${m}`);
    },
    [onSlotClick, currentDate]
  );

  const contentHeight = HOURS.length * HOUR_HEIGHT;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b border-border/50 px-4 py-3">
        <h3 className="text-sm font-medium text-muted-foreground capitalize">
          {currentDate.toLocaleDateString("es-PA", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h3>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
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

          <div className={cn("relative border-l border-border/50", isToday(currentDate) && "bg-primary/[0.03]")}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                style={{ height: HOUR_HEIGHT }}
                onClick={() => handleSlotClick(hour)}
              />
            ))}

            {daySchedule.map((block) => {
              const startMin = timeToMinutes(block.startTime);
              const endMin = timeToMinutes(block.endTime);
              const top = minutesToPixels(startMin, HOUR_HEIGHT);
              const height = Math.max(minutesToPixels(endMin - startMin, HOUR_HEIGHT), 28);

              return (
                <div
                  key={block.id}
                  className="absolute left-2 right-2 rounded-lg px-3 py-2 overflow-hidden border border-transparent hover:border-foreground/20 transition-colors group"
                  style={{ top, height, backgroundColor: block.color + "cc", color: "white" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{block.name}</p>
                      {height > 40 && (
                        <p className="text-xs leading-tight opacity-90 mt-0.5">
                          {formatTime(block.startTime)} – {formatTime(block.endTime)}
                        </p>
                      )}
                    </div>
                    {block.pdfUrl && (
                      <a
                        href={block.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title={block.pdfName ?? "Ver PDF"}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileText className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {dayEvents.map((evt) => {
              const startMin = timeToMinutes(evt.startTime);
              const endMin = timeToMinutes(evt.endTime);
              const top = minutesToPixels(startMin, HOUR_HEIGHT);
              const height = Math.max(minutesToPixels(endMin - startMin, HOUR_HEIGHT), 28);

              return (
                <div
                  key={evt.id}
                  className="absolute left-2 right-2 rounded-lg px-3 py-2 overflow-hidden border border-transparent hover:border-foreground/20 transition-colors cursor-pointer"
                  style={{ top, height, backgroundColor: evt.color + "cc", color: "white" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(evt);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{evt.title}</p>
                    {height > 40 && (
                      <p className="text-xs leading-tight opacity-90 mt-0.5">
                        {formatTime(evt.startTime)} – {formatTime(evt.endTime)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {dayTasks.map((task, i) => {
              const baseHour = 7;
              const top = (baseHour + i) * HOUR_HEIGHT + 8;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "absolute left-2 right-2 rounded-lg px-3 py-2 overflow-hidden border border-transparent hover:border-foreground/20 transition-colors",
                    task.priority === "urgent" && "bg-red-500/90 text-white",
                    task.priority === "high" && "bg-orange-400/90 text-white",
                    task.priority === "medium" && "bg-blue-500/90 text-white",
                    task.priority === "low" && "bg-muted-foreground/30 text-foreground"
                  )}
                  style={{ top, height: 36 }}
                >
                  <p className="text-sm font-medium leading-tight truncate">{task.title}</p>
                </div>
              );
            })}

            {(() => {
              const now = new Date();
              if (!isToday(currentDate)) return null;
              const minutes = now.getHours() * 60 + now.getMinutes();
              const top = minutesToPixels(minutes, HOUR_HEIGHT);
              return (
                <div
                  className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                  style={{ top }}
                >
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-primary -translate-x-1/2 -ml-0.5" />
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
