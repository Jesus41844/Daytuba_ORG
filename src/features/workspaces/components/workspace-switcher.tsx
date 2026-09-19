"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Settings2, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveWorkspace } from "@/features/workspaces/actions";

export type SidebarWorkspace = {
  id: string;
  name: string;
  color: string;
  role: string;
};

function WorkspaceDot({ color }: { color: string }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
      style={{ backgroundColor: color || "#6366f1" }}
    >
      <Building2 className="size-3" />
    </span>
  );
}

function PersonalDot({ isWorkspacesPage }: { isWorkspacesPage: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md",
        isWorkspacesPage
          ? "bg-primary/15 text-primary"
          : "bg-secondary text-secondary-foreground"
      )}
    >
      <UserRound className="size-3" />
    </span>
  );
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId = null,
  className,
}: {
  workspaces: SidebarWorkspace[];
  activeWorkspaceId?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const isWorkspacesPage = pathname.startsWith("/dashboard/workspaces");
  const current = activeWorkspaceId
    ? workspaces.find((ws) => ws.id === activeWorkspaceId)
    : undefined;

  const label = current
    ? current.name
    : isWorkspacesPage
      ? "Espacios de trabajo"
      : "Personal";

  function selectWorkspace(wsId: string | null) {
    startTransition(async () => {
      await setActiveWorkspace(wsId);
      router.refresh();
    });
  }

  function navigateToManageWorkspaces() {
    router.push("/dashboard/workspaces");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-start gap-2 rounded-xl px-2 py-1.5",
              className
            )}
            aria-label="Cambiar espacio de trabajo"
          />
        }
      >
        {current ? (
          <WorkspaceDot color={current.color} />
        ) : (
          <PersonalDot isWorkspacesPage={isWorkspacesPage} />
        )}
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
          {label}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {/* El label es un Menu.GroupLabel de Base UI: lanza si no está dentro
            de un Menu.Group, así que el grupo no es decorativo. */}
        <DropdownMenuGroup className="flex flex-col gap-0.5 p-1">
          <DropdownMenuLabel>Espacios de trabajo</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => selectWorkspace(null)}
            disabled={isPending}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <PersonalDot isWorkspacesPage={isWorkspacesPage} />
              <span>Personal</span>
            </div>
            {activeWorkspaceId === null && !isWorkspacesPage && (
              <Check className="size-4 text-primary" />
            )}
          </DropdownMenuItem>
          {workspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <DropdownMenuItem
                key={ws.id}
                onSelect={() => selectWorkspace(ws.id)}
                disabled={isPending}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <WorkspaceDot color={ws.color} />
                  <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                </div>
                {isActive && <Check className="size-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={navigateToManageWorkspaces}
          className="gap-2"
        >
          <Settings2 className="size-4" />
          Gestionar espacios
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
