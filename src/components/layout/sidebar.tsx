"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Menu,
  Home,
  CheckSquare,
  FolderOpen,
  CalendarDays,
  CalendarClock,
  Inbox,
  Settings,
  Tag,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/auth/session";
import { logout } from "@/features/auth/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SidebarSearch } from "@/components/layout/sidebar-search";
import { useSidebarWidth } from "@/components/layout/sidebar-provider";

const NAV_ITEMS = [
  { label: "Dashboard", icon: Home, href: "/dashboard" },
  { label: "Tareas", icon: CheckSquare, href: "/dashboard/tasks" },
  { label: "Proyectos", icon: FolderOpen, href: "/dashboard/projects" },
  { label: "Categorías", icon: Tag, href: "/dashboard/categories" },
  { label: "Calendario", icon: CalendarDays, href: "/dashboard/calendar" },
  { label: "Horario", icon: CalendarClock, href: "/dashboard/schedule" },
  { label: "Bandeja", icon: Inbox, href: "/dashboard/inbox" },
  { label: "Configuración", icon: Settings, href: "/dashboard/settings" },
] as const;

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({
  compact,
  onNavigate,
}: {
  compact: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const isActive = isActivePath(pathname, item.href);
        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-full text-sm font-medium transition-colors",
              compact ? "justify-center px-0 py-2.5" : "px-4 py-2.5",
              isActive
                ? "bg-secondary text-primary font-semibold shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {!compact && <span className="truncate">{item.label}</span>}
          </Link>
        );

        if (compact) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger render={<div />}>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }

        return link;
      })}
    </nav>
  );
}

function SidebarUser({
  user,
  compact,
}: {
  user: AuthUser | null;
  compact: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();
  const initials = user ? getInitials(user.displayName || user.email) : "?";

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href="/dashboard/settings"
                className="flex items-center justify-center"
              />
            }
          >
            <Avatar size="sm">
              {user?.photoUrl ? (
                <AvatarImage src={user.photoUrl} alt={user.displayName} />
              ) : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="right">
            {user?.displayName || "Mi cuenta"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Cerrar sesión"
                disabled={isPending}
                onClick={() => startTransition(async () => void (await logout()))}
              />
            }
          >
            <LogOut className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="right">Cerrar sesión</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Link
        href="/dashboard/settings"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/50"
      >
        <Avatar size="sm">
          {user?.photoUrl ? (
            <AvatarImage src={user.photoUrl} alt={user.displayName} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            {user?.displayName || "Mi cuenta"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {user?.email ?? ""}
          </span>
        </div>
        <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
      </Link>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Cerrar sesión"
              disabled={isPending}
              onClick={() => startTransition(async () => void (await logout()))}
            />
          }
        >
          <LogOut />
        </TooltipTrigger>
        <TooltipContent>Cerrar sesión</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ResizeHandle() {
  const { width, setWidth } = useSidebarWidth();
  const isDragging = React.useRef(false);
  const startX = React.useRef(0);
  const startWidth = React.useRef(0);

  React.useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      setWidth(startWidth.current + delta);
    }

    function onMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [setWidth]);

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar barra lateral"
      onMouseDown={onMouseDown}
      className="group absolute top-0 right-0 z-50 h-full w-1.5 cursor-col-resize transition-colors hover:bg-primary/20 active:bg-primary/40"
    >
      <div className="mx-auto h-8 w-px rounded-full bg-border/50 transition-colors group-hover:bg-primary/50" />
    </div>
  );
}

function SidebarBody({
  user,
  compact,
  onNavigate,
}: {
  user: AuthUser | null;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const { collapse, expand } = useSidebarWidth();

  return (
    <TooltipProvider>
      <div className="relative flex h-full flex-col">
        <div
          className={cn(
            "flex items-center py-3",
            compact ? "flex-col gap-2 px-2" : "gap-2.5 px-4"
          )}
        >
          <button
            onClick={() => (compact ? expand() : collapse())}
            className="flex size-9 cursor-pointer items-center justify-center rounded-2xl text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
            title={compact ? "Expandir menú" : "Colapsar menú"}
            aria-label={compact ? "Expandir menú" : "Colapsar menú"}
          >
            {compact ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </button>
          {!compact && (
            <>
              <span className="text-sm font-bold tracking-tight">Daytuba</span>
              <ThemeToggle className="ml-auto size-9" />
            </>
          )}
          {compact && <ThemeToggle className="size-9" />}
        </div>
        <Separator className="opacity-50" />
        {!compact && (
          <>
            <SidebarSearch />
            <Separator className="opacity-50" />
          </>
        )}
        <ScrollArea className="flex-1 py-3">
          <SidebarNav compact={compact} onNavigate={onNavigate} />
        </ScrollArea>
        <Separator className="opacity-50" />
        <SidebarUser user={user} compact={compact} />
        {!compact && <ResizeHandle />}
      </div>
    </TooltipProvider>
  );
}

export function Sidebar({ user }: { user: AuthUser | null }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { width, collapsed } = useSidebarWidth();

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-sm lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Abrir menú" />
            }
          >
            <Menu />
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] gap-0 p-0">
            <SheetTitle className="sr-only">Navegación</SheetTitle>
            <SidebarBody
              user={user}
              compact={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <span className="text-sm font-bold tracking-tight">Daytuba</span>
      </header>

      <aside
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-background/80 backdrop-blur-sm lg:flex"
        style={{ width: `${collapsed ? 64 : width}px` }}
      >
        <SidebarBody user={user} compact={collapsed} />
      </aside>
    </>
  );
}
