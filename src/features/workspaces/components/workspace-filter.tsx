"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/types";
import { setActiveWorkspace } from "@/features/workspaces/actions";

export type FilterWorkspace = {
  id: string;
  name: string;
  color: string;
  role: WorkspaceRole;
};

export function WorkspaceFilter({
  workspaces,
  activeWorkspaceId,
  className,
}: {
  workspaces: FilterWorkspace[];
  activeWorkspaceId: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectWorkspace(wsId: string | null) {
    startTransition(async () => {
      await setActiveWorkspace(wsId);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        className
      )}
    >
      <button
        onClick={() => selectWorkspace(null)}
        disabled={isPending}
        aria-current={activeWorkspaceId === null ? "page" : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50",
          activeWorkspaceId === null
            ? "border-primary/40 bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <UserRound className="size-3.5" />
        Personal
      </button>
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        return (
          <button
            key={ws.id}
            onClick={() => selectWorkspace(ws.id)}
            disabled={isPending}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50",
              isActive
                ? "border-primary/40 bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Building2
              className="size-3.5"
              style={{ color: ws.color }}
              fill={ws.color}
            />
            {ws.name}
          </button>
        );
      })}
    </div>
  );
}