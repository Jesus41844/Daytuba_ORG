"use client";

import Link from "next/link";
import { Building2, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/types";

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
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        className
      )}
    >
      <Link
        href="/dashboard/projects"
        aria-current={activeWorkspaceId === null ? "page" : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          activeWorkspaceId === null
            ? "border-primary/40 bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <UserRound className="size-3.5" />
        Personal
      </Link>
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        return (
          <Link
            key={ws.id}
            href={`/dashboard/projects?ws=${ws.id}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
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
          </Link>
        );
      })}
    </div>
  );
}