"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, ChevronsUpDown, Settings2, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  className,
}: {
  workspaces: SidebarWorkspace[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeWsId = searchParams.get("ws");

  const isWorkspacesPage = pathname.startsWith("/dashboard/workspaces");
  const current = activeWsId
    ? workspaces.find((ws) => ws.id === activeWsId)
    : undefined;

  const label = current
    ? current.name
    : isWorkspacesPage
      ? "Espacios de trabajo"
      : "Personal";

  function navigateTo(href: string) {
    if (href !== pathname) router.push(href);
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
        <DropdownMenuLabel>Espacios de trabajo</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={activeWsId ?? "personal"}>
          <DropdownMenuRadioItem
            value="personal"
            onSelect={() => navigateTo("/dashboard/projects")}
            className="gap-2"
          >
            <PersonalDot isWorkspacesPage={isWorkspacesPage} />
            <span className="flex-1">Personal</span>
          </DropdownMenuRadioItem>
          {workspaces.map((ws) => (
            <DropdownMenuRadioItem
              key={ws.id}
              value={ws.id}
              onSelect={() =>
                navigateTo(`/dashboard/projects?ws=${ws.id}`)
              }
              className="gap-2"
            >
              <WorkspaceDot color={ws.color} />
              <span className="min-w-0 flex-1 truncate">{ws.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigateTo("/dashboard/workspaces")}
          className="gap-2"
        >
          <Settings2 className="size-4" />
          Gestionar espacios
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}