"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Folder,
  Inbox,
  Loader2,
  Link,
  Pencil,
  Plus,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project, Task } from "@/types";
import { createProject, updateProject, deleteProject } from "../actions";
import { unlinkMoodleProject } from "@/features/moodle/actions";
import { TaskCard } from "@/features/tasks/components/task-card";
import { ShareProjectDialog } from "@/features/collaboration/components/share-project-dialog";

const PROJECT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#f43f5e",
];

type ProjectListProps = {
  projects: Project[];
  tasks: Task[];
  currentUserId: string;
  workspaceId?: string | null;
  canManageWorkspace?: boolean;
};

export function ProjectList({
  projects,
  tasks,
  currentUserId,
  workspaceId = null,
  canManageWorkspace = true,
}: ProjectListProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [unlinkPendingId, setUnlinkPendingId] = useState<string | null>(null);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = task.projectId ?? "__unassigned__";
      const group = map.get(key);
      if (group) {
        group.push(task);
      } else {
        map.set(key, [task]);
      }
    }
    return map;
  }, [tasks]);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleAddProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      await createProject({ name: name.trim(), workspaceId: workspaceId ?? null });
      setName("");
      setIsAdding(false);
      router.refresh();
    });
  }

  function startEditing(project: Project) {
    setEditingId(project.id);
    setEditName(project.name);
    setEditColor(project.color);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  }

  function handleUpdate(projectId: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      await updateProject(projectId, {
        name: editName.trim(),
        color: editColor,
      });
      cancelEditing();
      router.refresh();
    });
  }

  function handleDelete(projectId: string) {
    setDeletePendingId(projectId);
    startTransition(async () => {
      await deleteProject(projectId);
      setDeletePendingId(null);
      router.refresh();
    });
  }

  function handleUnlink(projectId: string) {
    setUnlinkPendingId(projectId);
    startTransition(async () => {
      await unlinkMoodleProject(projectId);
      setUnlinkPendingId(null);
      router.refresh();
    });
  }

  function renderGroup(
    id: string,
    label: string,
    color: string | null,
    groupTasks: Task[],
    project?: Project
  ) {
    const isCollapsed = collapsed.has(id);

    return (
      <section key={id} className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-muted/50">
          <button
            type="button"
            onClick={() => toggleCollapsed(id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={!isCollapsed}
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                isCollapsed && "-rotate-90"
              )}
            />
            {id === "__unassigned__" ? (
              <Inbox className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color ?? "#6b7280" }}
              />
            )}

            {editingId === id ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 w-48 text-sm"
                  autoFocus
                />
                <div className="flex gap-0.5">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className="size-4 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor:
                          editColor === c ? "currentColor" : "transparent",
                      }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={isPending || !editName.trim()}
                  onClick={() => handleUpdate(id)}
                  aria-label="Guardar"
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={cancelEditing}
                  aria-label="Cancelar"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium">{label}</span>
                {project?.moodleCourseId && (
                  <span title="Vinculado a Moodle">
                    <Link className="size-3 shrink-0 text-muted-foreground" />
                  </span>
                )}
                <Badge variant="secondary" className="ml-auto">
                  {groupTasks.length}
                </Badge>
              </>
            )}
          </button>

          {editingId !== id &&
            project &&
            (project.userId === currentUserId ||
              (project.workspaceId != null && canManageWorkspace)) && (
            <div className="flex shrink-0 gap-0.5">
              {project.moodleCourseId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={isPending && unlinkPendingId === id}
                  onClick={() => handleUnlink(id)}
                  title="Desvincular de Moodle (el proyecto se mantiene)"
                  aria-label={`Desvincular proyecto ${label} de Moodle`}
                >
                  {unlinkPendingId === id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Unlink className="size-3.5" />
                  )}
                </Button>
              )}
              <ShareProjectDialog project={project} isOwner />
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => startEditing(project)}
                aria-label={`Editar proyecto ${label}`}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={isPending && deletePendingId === id}
                onClick={() => handleDelete(id)}
                aria-label={`Eliminar proyecto ${label}`}
              >
                {deletePendingId === id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div className="grid gap-3 pl-6 sm:grid-cols-2 xl:grid-cols-3">
            {groupTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay tareas en este proyecto.
              </p>
            ) : (
              groupTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))
            )}
          </div>
        )}
      </section>
    );
  }

  const unassigned = tasksByProject.get("__unassigned__") ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Proyectos</h2>
        {!isAdding && canManageWorkspace && (
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
            <Plus data-icon="inline-start" />
            Añadir proyecto
          </Button>
        )}
      </div>

      {isAdding && canManageWorkspace && (
        <form onSubmit={handleAddProject} className="flex items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Folder className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del proyecto"
              autoFocus
              className="pl-8"
            />
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
              setIsAdding(false);
              setName("");
            }}
            aria-label="Cancelar"
          >
            <X className="size-4" />
          </Button>
        </form>
      )}

      {projects.map((project) =>
        renderGroup(
          project.id,
          project.name,
          project.color,
          tasksByProject.get(project.id) ?? [],
          project
        )
      )}

      {renderGroup("__unassigned__", "Sin proyecto", null, unassigned)}
    </div>
  );
}
