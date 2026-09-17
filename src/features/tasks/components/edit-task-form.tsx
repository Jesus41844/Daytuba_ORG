"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { Project, Task, Category } from "@/types";
import { updateTaskSchema, type UpdateTaskInput } from "@/lib/validations";
import { updateTask } from "../actions";
import { getAssignableUsers, type AssignableUser } from "../queries";
import {
  addCategoryToTask,
  removeCategoryFromTask,
} from "@/features/categories/actions";
import { PdfUpload } from "./pdf-upload";

type EditTaskFormProps = {
  task: Task;
  projects: Project[];
  allCategories: Category[];
  taskCategories: Category[];
  assignees: AssignableUser[];
  readOnly?: boolean;
};

const STATUS_ITEMS = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En progreso" },
  { value: "review", label: "En revisión" },
  { value: "completed", label: "Completada" },
  { value: "cancelled", label: "Cancelada" },
];

const PRIORITY_ITEMS = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function EditTaskForm({
  task,
  projects,
  allCategories,
  taskCategories: initialTaskCategories,
  assignees: initialAssignees,
  readOnly = false,
}: EditTaskFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [taskCategoryIds, setTaskCategoryIds] = useState<string[]>(
    initialTaskCategories.map((c) => c.id)
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(task.pdfUrl);
  const [pdfName, setPdfName] = useState<string | null>(task.pdfName);
  const [assignees, setAssignees] = useState<AssignableUser[]>(initialAssignees);

  const form = useForm<UpdateTaskInput>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      projectId: task.projectId ?? "",
      assigneeId: task.assigneeId ?? null,
      dueDate: task.dueDate?.slice(0, 10) ?? "",
      startDate: task.startDate?.slice(0, 10) ?? "",
      reminderAt: task.reminderAt?.slice(0, 16) ?? "",
    },
  });

  const watchedStatus = useWatch({ control: form.control, name: "status" });
  const watchedPriority = useWatch({ control: form.control, name: "priority" });
  const watchedProjectId = useWatch({ control: form.control, name: "projectId" });
  const watchedAssigneeId = useWatch({ control: form.control, name: "assigneeId" });

  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    let cancelled = false;
    getAssignableUsers(watchedProjectId || null)
      .then((users) => {
        if (cancelled) return;
        setAssignees(users);
        const current = form.getValues("assigneeId");
        if (current && !users.some((user) => user.id === current)) {
          form.setValue("assigneeId", null);
        }
      })
      .catch(() => {
        if (!cancelled) setAssignees(initialAssignees);
      });
    return () => {
      cancelled = true;
    };
  }, [watchedProjectId, initialAssignees, form]);


  const projectItems = [
    { value: "", label: "Sin proyecto" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const selectedProjectLabel = projectItems.find((p) => p.value === (watchedProjectId ?? ""))?.label ?? "Sin proyecto";

  const assigneeItems = [
    { value: "", label: "Sin asignar" },
    ...assignees.map((user) => ({
      value: user.id,
      label: user.displayName || user.email,
    })),
  ];

  const selectedAssigneeLabel =
    assigneeItems.find((a) => a.value === (watchedAssigneeId ?? ""))?.label ??
    "Sin asignar";

  function toggleCategory(categoryId: string) {
    startTransition(async () => {
      if (taskCategoryIds.includes(categoryId)) {
        await removeCategoryFromTask(task.id, categoryId);
        setTaskCategoryIds((prev) => prev.filter((id) => id !== categoryId));
      } else {
        await addCategoryToTask(task.id, categoryId);
        setTaskCategoryIds((prev) => [...prev, categoryId]);
      }
      router.refresh();
    });
  }

  function onSubmit(data: UpdateTaskInput) {
    setError(null);

    startTransition(async () => {
      const result = await updateTask(task.id, {
        title: data.title?.trim(),
        description: data.description?.trim() || undefined,
        status: data.status,
        priority: data.priority,
        projectId: data.projectId || undefined,
        assigneeId: data.assigneeId || null,
        dueDate: data.dueDate || undefined,
        startDate: data.startDate || undefined,
        reminderAt: data.reminderAt || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/tasks");
    });
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input
              id="edit-title"
              placeholder="Título de la tarea"
              disabled={readOnly}
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-description">Descripción</Label>
            <Textarea
              id="edit-description"
              placeholder="Descripción opcional..."
              rows={3}
              disabled={readOnly}
              {...form.register("description")}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Estado</Label>
              <Select
                value={watchedStatus}
                disabled={readOnly}
                onValueChange={(v) =>
                  v && form.setValue("status", v as Task["status"])
                }
              >
                <SelectTrigger>
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
            </div>

            <div className="flex flex-col gap-2">
              <Label>Prioridad</Label>
              <Select
                value={watchedPriority}
                disabled={readOnly}
                onValueChange={(v) =>
                  v && form.setValue("priority", v as Task["priority"])
                }
              >
                <SelectTrigger>
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
            </div>

            <div className="flex flex-col gap-2">
              <Label>Proyecto</Label>
              <Select
                value={watchedProjectId ?? ""}
                disabled={readOnly}
                onValueChange={(v) => form.setValue("projectId", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue>{selectedProjectLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Asignado a</Label>
              <Select
                value={watchedAssigneeId ?? ""}
                disabled={readOnly}
                onValueChange={(v) => form.setValue("assigneeId", v || null)}
              >
                <SelectTrigger>
                  <SelectValue>{selectedAssigneeLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assigneeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-dueDate">Fecha de vencimiento</Label>
              <Input
                id="edit-dueDate"
                type="date"
                disabled={readOnly}
                {...form.register("dueDate")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-startDate">Fecha de inicio</Label>
              <Input
                id="edit-startDate"
                type="date"
                disabled={readOnly}
                {...form.register("startDate")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-reminderAt">Recordatorio</Label>
              <Input
                id="edit-reminderAt"
                type="datetime-local"
                disabled={readOnly}
                {...form.register("reminderAt")}
              />
            </div>
          </div>

          {allCategories.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Categorías</Label>
              {readOnly ? (
                <div className="flex flex-wrap gap-1.5">
                  {allCategories
                    .filter((c) => taskCategoryIds.includes(c.id))
                    .map((category) => (
                      <span
                        key={category.id}
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: category.color + "30",
                          color: category.color,
                          borderColor: category.color,
                        }}
                      >
                        {category.name}
                      </span>
                    ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => toggleCategory(category.id)}
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: taskCategoryIds.includes(category.id)
                          ? category.color + "30"
                          : "transparent",
                        color: taskCategoryIds.includes(category.id)
                          ? category.color
                          : undefined,
                        borderColor: taskCategoryIds.includes(category.id)
                          ? category.color
                          : undefined,
                      }}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!readOnly && (
            <div className="flex flex-col gap-2">
              <Label>PDF Adjunto</Label>
              <PdfUpload
                taskId={task.id}
                currentPdfUrl={pdfUrl}
                currentPdfName={pdfName}
                onUploadComplete={(url, name) => {
                  setPdfUrl(url);
                  setPdfName(name);
                }}
                onDeleteComplete={() => {
                  setPdfUrl(null);
                  setPdfName(null);
                }}
              />
            </div>
          )}

          {readOnly && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Vista de solo lectura: este proyecto fue compartido contigo sin
              permisos de edición.
            </p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {!readOnly && (
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
