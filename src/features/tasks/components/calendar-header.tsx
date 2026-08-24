"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "month";

type CalendarHeaderProps = {
  currentDate: Date;
  viewMode: ViewMode;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (mode: ViewMode) => void;
};

const VIEW_LABELS: Record<ViewMode, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
};

function formatTitle(date: Date, view: ViewMode): string {
  if (view === "day") {
    return date.toLocaleDateString("es-PA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (view === "week") {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sameMonth =
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      return `${start.toLocaleDateString("es-PA", { day: "numeric" })} – ${end.toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" })}`;
    }
    return `${start.toLocaleDateString("es-PA", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return date.toLocaleDateString("es-PA", {
    month: "long",
    year: "numeric",
  });
}

export function CalendarHeader({
  currentDate,
  viewMode,
  onPrev,
  onNext,
  onToday,
  onViewChange,
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-1 py-2 flex-wrap">
      <div className="flex items-center gap-1 mr-2">
        <Button variant="ghost" size="icon" onClick={onToday} className="h-8 px-3 text-sm font-medium">
          Hoy
        </Button>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onPrev} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <h2 className="text-lg font-semibold capitalize mr-auto truncate">
        {formatTitle(currentDate, viewMode)}
      </h2>

      <div className="flex rounded-lg bg-muted p-0.5">
        {(["day", "week", "month"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onViewChange(mode)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              viewMode === mode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {VIEW_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}
