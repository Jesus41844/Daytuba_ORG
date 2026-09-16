"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Project } from "@/types";
import { cn } from "@/lib/utils";
import {
  getProjectMembers,
  searchUserByEmail,
  type ProjectMemberProfile,
  type UserSearchResult,
} from "../queries";
import { inviteMember, updateMemberRole, removeMember } from "../actions";

const ROLE_LABELS: Record<ProjectMemberProfile["role"], string> = {
  owner: "Propietario",
  viewer: "Solo lectura",
  editor: "Editor",
};

type ShareProjectDialogProps = {
  project: Project;
  isOwner: boolean;
};

export function ShareProjectDialog({ project, isOwner }: ShareProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<ProjectMemberProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [pendingInvite, setPendingInvite] = useState(false);
  const [rolePending, setRolePending] = useState<string | null>(null);
  const [removePending, setRemovePending] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getProjectMembers(project.id)
      .then(setMembers)
      .catch(() => setError("No se pudieron cargar los miembros"))
      .finally(() => setLoading(false));
  }, [open, project.id]);

  useEffect(() => {
    if (!email.trim() || !open) return;
    const timer = setTimeout(() => {
      searchUserByEmail(email).then(setSuggestions).catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [email, open]);

  function refresh() {
    getProjectMembers(project.id).then(setMembers).catch(() => undefined);
    router.refresh();
  }

  function handleInvite() {
    if (!email.trim()) return;
    setError(null);
    setPendingInvite(true);
    startTransition(async () => {
      const result = await inviteMember({
        projectId: project.id,
        email: email.trim(),
        role,
      });
      setPendingInvite(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEmail("");
      setSuggestions([]);
      refresh();
    });
  }

  function handleRoleChange(memberUserId: string, newRole: "viewer" | "editor") {
    setRolePending(memberUserId);
    setError(null);
    updateMemberRole({
      projectId: project.id,
      memberUserId,
      role: newRole,
    }).then((result) => {
      setRolePending(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      refresh();
    });
  }

  function handleRemove(memberUserId: string) {
    if (!window.confirm("¿Eliminar a este miembro del proyecto?")) return;
    setRemovePending(memberUserId);
    startTransition(async () => {
      await removeMember(project.id, memberUserId);
      setRemovePending(null);
      refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="Compartir proyecto"
            aria-label={`Compartir proyecto ${project.name}`}
          >
            <Users className="size-3.5" />
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Compartir proyecto</SheetTitle>
          <SheetDescription>
            Invita a usuarios registrados para colaborar en {project.name}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex flex-col gap-2">
            <Label
              htmlFor={`invite-email-${project.id}`}
            >
              Email del usuario
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id={`invite-email-${project.id}`}
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleInvite();
                    }
                  }}
                />
                {suggestions.length > 0 && (
                  <div className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-md border bg-popover shadow-lg">
                    {suggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setEmail(user.email);
                          setSuggestions([]);
                        }}
                      >
                        <Avatar className="size-5">
                          <AvatarFallback className="text-[10px]">
                            {user.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate">{user.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div
                className="flex items-center rounded-full border border-border/60 p-1"
                role="group"
                aria-label="Rol de acceso"
              >
                {(["viewer", "editor"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      role === r
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isPending || pendingInvite || !email.trim()}
              onClick={handleInvite}
            >
              {(isPending || pendingInvite) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus data-icon="inline-start" />
              )}
              Invitar
            </Button>
          </div>

          <div className="flex flex-col gap-0.5 border-t pt-4">
            {loading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Cargando miembros...
              </p>
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Aún no hay miembros.
              </p>
            ) : (
              members.map((member) => {
                const isOwnerRow = member.role === "owner";
                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-2 rounded-lg px-1 py-1.5"
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[10px]">
                        {(member.displayName || member.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.displayName || member.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>

                    {isOwnerRow ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          "bg-muted text-muted-foreground"
                        )}
                      >
                        Propietario
                      </span>
                    ) : isOwner ? (
                      <div className="flex items-center gap-1">
                        <div
                          className="flex items-center rounded-full border border-border/60 p-0.5"
                          role="group"
                          aria-label={`Rol de ${member.displayName || member.email}`}
                        >
                          {(["viewer", "editor"] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              disabled={rolePending === member.userId || removePending === member.userId}
                              onClick={() => handleRoleChange(member.userId, r)}
                              className={cn(
                                "cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                                member.role === r
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              {ROLE_LABELS[r]}
                            </button>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={rolePending === member.userId || removePending === member.userId}
                          onClick={() => handleRemove(member.userId)}
                          title="Quitar del proyecto"
                          aria-label={`Quitar a ${member.displayName || member.email}`}
                        >
                          {removePending === member.userId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {ROLE_LABELS[member.role]}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}