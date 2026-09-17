"use client";

import { CalendarRange, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, Project } from "@/types";

export type CalendarFilterState = {
  from: string;
  to: string;
  status: string;
  priority: string;
  projectId: string;
  categoryId: string;
};

export const EMPTY_CALENDAR_FILTERS: CalendarFilterState = {
  from: "",
  to: "",
  status: "",
  priority: "",
  projectId: "",
  categoryId: "",
};

const STATUS_ITEMS = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "in_progress", label: "En progreso" },
  { value: "review", label: "En revisión" },
  { value: "completed", label: "Completadas" },
  { value: "cancelled", label: "Canceladas" },
];

const PRIORITY_ITEMS = [
  { value: "", label: "Todas" },
  { value: "urgent", label: "Urgente" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

export function hasActiveCalendarFilters(filters: CalendarFilterState): boolean {
  return Object.values(filters).some((value) => value !== "");
}

type CalendarFiltersProps = {
  filters: CalendarFilterState;
  onChange: (filters: CalendarFilterState) => void;
  projects: Project[];
  categories: Category[];
  matchCount: number;
};

export function CalendarFilters({
  filters,
  onChange,
  projects,
  categories,
  matchCount,
}: CalendarFiltersProps) {
  function update<K extends keyof CalendarFilterState>(
    key: K,
    value: CalendarFilterState[K]
  ) {
    onChange({ ...filters, [key]: value });
  }

  const projectItems = [
    { value: "", label: "Todos" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];
  const categoryItems = [
    { value: "", label: "Todas" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const active = hasActiveCalendarFilters(filters);

  return (
    <div className="flex flex-wrap items-end gap-2 px-1 pb-2">
      <div className="flex items-end gap-1.5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Desde
          </label>
          <Input
            type="date"
            aria-label="Fecha desde"
            value={filters.from}
            onChange={(e) => update("from", e.target.value)}
            className="h-8 w-[135px] text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Hasta
          </label>
          <Input
            type="date"
            aria-label="Fecha hasta"
            value={filters.to}
            onChange={(e) => update("to", e.target.value)}
            className="h-8 w-[135px] text-xs"
          />
        </div>
      </div>

      <Select
        items={STATUS_ITEMS}
        value={filters.status}
        onValueChange={(value) => update("status", value ?? "")}
      >
        <SelectTrigger size="sm" aria-label="Estado">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={PRIORITY_ITEMS}
        value={filters.priority}
        onValueChange={(value) => update("priority", value ?? "")}
      >
        <SelectTrigger size="sm" aria-label="Prioridad">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {projects.length > 0 && (
        <Select
          items={projectItems}
          value={filters.projectId}
          onValueChange={(value) => update("projectId", value ?? "")}
        >
          <SelectTrigger size="sm" aria-label="Proyecto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projectItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {categories.length > 0 && (
        <Select
          items={categoryItems}
          value={filters.categoryId}
          onValueChange={(value) => update("categoryId", value ?? "")}
        >
          <SelectTrigger size="sm" aria-label="Categoría">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarRange className="size-3.5" />
        <span className="tabular-nums">
          {matchCount} {matchCount === 1 ? "tarea" : "tareas"}
        </span>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => onChange(EMPTY_CALENDAR_FILTERS)}
          >
            <X data-icon="inline-start" />
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}