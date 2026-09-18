"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createWorkspace,
  deleteWorkspace,
  inviteWorkspaceMember,
  leaveWorkspace,
  removeWorkspaceMember,
  updateWorkspace,
  updateWorkspaceMemberRole,
} from "../actions";
import {
  getWorkspaceMembers,
  searchWorkspaceInviteUsers,
} from "../queries";
import type { Workspace, WorkspaceMember, WorkspaceRole } from "@/types";
import type { WorkspaceWithRole } from "../queries";

const WORKSPACE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
];

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: "Administrador",
  member: "Miembro",
  viewer: "Solo lectura",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

function RoleSelect({
  value,
  disabled,
  onSelect,
  pending,
}: {
  value: WorkspaceRole;
  disabled?: boolean;
  pending?: boolean;
  onSelect: (role: WorkspaceRole) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      <Select value={value} onValueChange={(next) => {
        if (next) onSelect(next as WorkspaceRole);
      }} disabled={disabled || pending}>
        <SelectTrigger className="h-7 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Administrador</SelectItem>
          <SelectItem value="member">Miembro</SelectItem>
          <SelectItem value="viewer">Solo lectura</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function CreateWorkspaceForm({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(WORKSPACE_COLORS[0]!);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setError(null);
    startTransition(async () => {
      const result = await createWorkspace({ name: name.trim(), color });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setName("");
      setColor(WORKSPACE_COLORS[0]!);
      setIsOpen(false);
      onCreated();
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="shrink-0"
        size="sm"
        variant="outline"
      >
        <Plus data-icon="inline-start" />
        Nuevo espacio
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Building2 className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del espacio (ej. UTP, Proyecto X)"
            autoFocus
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1">
          {WORKSPACE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="size-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c ? "currentColor" : "transparent",
              }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Crear
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setIsOpen(false);
            setName("");
          }}
          aria-label="Cancelar"
        >
          <X className="size-4" />
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}

function InviteForm({
  workspaceId,
  onInvited,
}: {
  workspaceId: string;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [suggestions, setSuggestions] = useState<
    { id: string; email: string; displayName: string }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleSearchChange(value: string) {
    setEmail(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void searchWorkspaceInviteUsers(value.trim(), workspaceId).then(
        (results) => {
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        }
      );
    }, 300);
  }

  function submit(inviteEmail: string) {
    if (!inviteEmail.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await inviteWorkspaceMember({
        workspaceId,
        email: inviteEmail.trim(),
        role,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEmail("");
      setSuggestions([]);
      setShowSuggestions(false);
      onInvited();
    });
  }

  return (
    <div className="relative flex flex-col gap-2">
      {showSuggestions && (
        <div className="absolute bottom-full left-0 z-10 mb-1 w-full overflow-hidden rounded-xl border bg-popover shadow-md">
          {suggestions.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                setEmail(user.email);
                setSuggestions([]);
                setShowSuggestions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="line-clamp-1 flex-1">
                <span className="font-medium">{user.displayName}</span>
                <span className="text-muted-foreground"> · {user.email}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                Invitar
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <UserPlus className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={email}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Email del miembro"
            className="pl-8"
            type="email"
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit(email);
              }
            }}
          />
        </div>
        <RoleSelect value={role} onSelect={setRole} />
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || !email.trim()}
          onClick={() => submit(email)}
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Invitar
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function MemberRow({
  member,
  workspace,
  canManage,
  currentUserId,
  onChanged,
  onLeft,
}: {
  member: WorkspaceMember;
  workspace: Workspace;
  canManage: boolean;
  currentUserId: string;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const router = useRouter();
  const [rolePending, setRolePending] = useState(false);
  const [removePending, setRemovePending] = useState(false);
  const isSelf = member.userId === currentUserId;
  const isOwner = workspace.createdBy === member.userId;

  function changeRole(role: WorkspaceRole) {
    if (!canManage) return;
    setRolePending(true);
    void (async () => {
      await updateWorkspaceMemberRole({
        workspaceId: workspace.id,
        memberUserId: member.userId,
        role,
      });
      setRolePending(false);
      onChanged();
      router.refresh();
    })();
  }

  function remove() {
    setRemovePending(true);
    void (async () => {
      await removeWorkspaceMember(workspace.id, member.userId);
      setRemovePending(false);
      onChanged();
      router.refresh();
    })();
  }

  function leave() {
    setRemovePending(true);
    void (async () => {
      await leaveWorkspace(workspace.id);
      setRemovePending(false);
      onLeft();
      router.refresh();
    })();
  }

  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted/50">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {getInitials(member.displayName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {member.displayName}
          </span>
          {isSelf && (
            <span className="shrink-0 text-xs text-muted-foreground">Tú</span>
          )}
          {isOwner && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              Creador
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>

      {canManage && !isSelf ? (
        <div className="flex items-center gap-1">
          {rolePending && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          <Select
            value={member.role}
            onValueChange={(next) => {
              if (next) changeRole(next as WorkspaceRole);
            }}
            disabled={removePending}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="member">Miembro</SelectItem>
              <SelectItem value="viewer">Solo lectura</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={remove}
            disabled={removePending || rolePending}
            aria-label={`Quitar a ${member.displayName}`}
          >
            {removePending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UserMinus className="size-3.5" />
            )}
          </Button>
        </div>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">
          {ROLE_LABELS[member.role]}
        </span>
      )}

      {isSelf && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={leave}
          disabled={removePending}
        >
          {removePending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LogOut className="size-3.5" />
          )}
          Salir
        </Button>
      )}
    </li>
  );
}

function WorkspaceCard({
  workspaceWithRole,
  currentUserId,
  onLeft,
}: {
  workspaceWithRole: WorkspaceWithRole;
  currentUserId: string;
  onLeft: () => void;
}) {
  const router = useRouter();
  const { workspace, role } = workspaceWithRole;
  const canManage = role === "admin";

  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [membersError, setMembersError] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(workspace.name);
  const [color, setColor] = useState(workspace.color || WORKSPACE_COLORS[0]!);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getWorkspaceMembers(workspace.id)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setMembersError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  function saveName() {
    if (!name.trim() || name.trim() === workspace.name) {
      setIsRenaming(false);
      return;
    }
    startTransition(async () => {
      await updateWorkspace({
        workspaceId: workspace.id,
        name: name.trim(),
        color,
      });
      setIsRenaming(false);
      router.refresh();
    });
  }

  function removeWorkspace() {
    startTransition(async () => {
      await deleteWorkspace(workspace.id);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: workspace.color || "#6366f1" }}
          >
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0">
            {isRenaming ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-7 w-48 text-sm"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveName();
                    if (event.key === "Escape") setIsRenaming(false);
                  }}
                />
                <div className="flex gap-0.5">
                  {WORKSPACE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="size-4 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor:
                          color === c ? "currentColor" : "transparent",
                      }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={saveName}
                  disabled={isPending}
                  aria-label="Guardar"
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setIsRenaming(false)}
                  aria-label="Cancelar"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{workspace.name}</CardTitle>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setIsRenaming(true)}
                    aria-label="Renombrar espacio"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
                <Badge variant="secondary" className="text-xs">
                  {ROLE_LABELS[role]}
                </Badge>
              </div>
            )}
            {!isRenaming && (
              <CardDescription className="mt-0.5 flex items-center gap-1.5 text-xs">
                <Users className="size-3.5" />
                {members === null
                  ? "Cargando miembros…"
                  : `${members.length} ${members.length === 1 ? "miembro" : "miembros"}`}
              </CardDescription>
            )}
          </div>
        </div>

        {canManage &&
          (confirmingDelete ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                variant="destructive"
                onClick={removeWorkspace}
                disabled={isPending}
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Eliminar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDelete(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDelete(true)}
              className="shrink-0 text-destructive"
            >
              <Trash2 data-icon="inline-start" />
              Eliminar
            </Button>
          ))}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {canManage && (
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Invitar miembro
            </p>
            <InviteForm
              workspaceId={workspace.id}
              onInvited={() => {
                void getWorkspaceMembers(workspace.id).then(setMembers);
              }}
            />
          </div>
        )}

        <div className="border-t pt-3">
          {membersError ? (
            <p className="text-sm text-destructive">
              No se pudieron cargar los miembros.
            </p>
          ) : members === null ? (
            <div className="flex flex-col gap-1.5">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-3 px-2 py-1.5"
                >
                  <span className="size-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3.5 w-32 rounded bg-muted" />
                    <div className="h-3 w-40 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {members.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  workspace={workspace}
                  canManage={canManage}
                  currentUserId={currentUserId}
                  onChanged={() => {
                    void getWorkspaceMembers(workspace.id).then(setMembers);
                  }}
                  onLeft={onLeft}
                />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceManager({
  initialWorkspaces,
  currentUserId,
}: {
  initialWorkspaces: WorkspaceWithRole[];
  currentUserId: string;
}) {
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const empty = workspaces.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mis espacios</h2>
        <CreateWorkspaceForm onCreated={() => {}} />
      </div>

      {empty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crea tu primer espacio de trabajo para compartir proyectos y
              tareas con tu equipo. «Personal» sigue disponible en el selector
              del menú lateral.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {workspaces.map((entry) => (
            <WorkspaceCard
              key={entry.workspace.id}
              workspaceWithRole={entry}
              currentUserId={currentUserId}
              onLeft={() => {
                setWorkspaces((prev) =>
                  prev.filter((ws) => ws.workspace.id !== entry.workspace.id)
                );
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}