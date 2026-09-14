"use client";

import { useState, useTransition } from "react";
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
}: EditTaskFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [taskCategoryIds, setTaskCategoryIds] = useState<string[]>(
    initialTaskCategories.map((c) => c.id)
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(task.pdfUrl);
  const [pdfName, setPdfName] = useState<string | null>(task.pdfName);

  const form = useForm<UpdateTaskInput>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      projectId: task.projectId ?? "",
      dueDate: task.dueDate?.slice(0, 10) ?? "",
      startDate: task.startDate?.slice(0, 10) ?? "",
      reminderAt: task.reminderAt?.slice(0, 16) ?? "",
    },
  });

  const watchedStatus = useWatch({ control: form.control, name: "status" });
  const watchedPriority = useWatch({ control: form.control, name: "priority" });
  const watchedProjectId = useWatch({ control: form.control, name: "projectId" });

  const projectItems = [
    { value: "", label: "Sin proyecto" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const selectedProjectLabel = projectItems.find((p) => p.value === (watchedProjectId ?? ""))?.label ?? "Sin proyecto";

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
              {...form.register("description")}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Estado</Label>
              <Select
                value={watchedStatus}
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
              <Label htmlFor="edit-dueDate">Fecha de vencimiento</Label>
              <Input
                id="edit-dueDate"
                type="date"
                {...form.register("dueDate")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-startDate">Fecha de inicio</Label>
              <Input
                id="edit-startDate"
                type="date"
                {...form.register("startDate")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-reminderAt">Recordatorio</Label>
              <Input
                id="edit-reminderAt"
                type="datetime-local"
                {...form.register("reminderAt")}
              />
            </div>
          </div>

          {allCategories.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Categorías</Label>
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
            </div>
          )}

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

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
