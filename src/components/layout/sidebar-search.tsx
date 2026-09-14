"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchTasks } from "@/features/tasks/queries";
import type { Task } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  review: "En revisión",
  completed: "Completada",
  cancelled: "Cancelada",
};

export function SidebarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Task[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevPath, setPrevPath] = useState(pathname);

  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      setOpen(false);
      setIsSearching(false);
      return;
    }

    setOpen(true);
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchTasks(value);
        if (query.trim()) setResults(found);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  }

  function handleSelect(task: Task) {
    setOpen(false);
    router.push(`/dashboard/tasks/${task.id}`);
  }

  return (
    <div ref={containerRef} className="relative px-2 pb-1">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) handleSelect(results[0]);
          }}
          placeholder="Buscar tarea..."
          aria-label="Buscar tarea"
          className="h-9 w-full rounded-full border border-border/60 bg-muted/40 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {open && query.trim() && (
        <div className="absolute right-2 left-2 z-50 mt-1.5 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-lg">
          {isSearching ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">
              Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">
              Sin resultados para “{query.trim()}”
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {results.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => handleSelect(task)}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <span className="line-clamp-1 text-sm font-medium">
                    {task.title}
                  </span>
                  <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className={cn("rounded-full px-1.5 ring-1 ring-border/50")}>
                      {STATUS_LABELS[task.status] ?? task.status}
                    </span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="size-3" />
                        {format(new Date(task.dueDate), "d MMM", { locale: es })}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}