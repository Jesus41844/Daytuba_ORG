"use client";

import { useState, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project, Task, Category } from "@/types";
import { createTaskSchema, type CreateTaskInput } from "@/lib/validations";
import { createTask } from "../actions";
import { uploadTaskPdf } from "@/features/files/actions";
import { parsePdf } from "@/lib/pdf";

type CreateTaskFormProps = {
  projects: Project[];
  categories: Category[];
  onCreated?: (task: Task) => void;
  onCancel?: () => void;
};

const PRIORITY_ITEMS = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function CreateTaskForm({
  projects,
  categories,
  onCreated,
  onCancel,
}: CreateTaskFormProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.input<typeof createTaskSchema>>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      priority: "medium",
      recurrence: "none",
    },
  });

  const watchedPriority = useWatch({ control: form.control, name: "priority" });
  const watchedProjectId = useWatch({ control: form.control, name: "projectId" });

  const projectItems = [
    { value: "", label: "Sin proyecto" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];

  const selectedProjectLabel = projectItems.find((p) => p.value === (watchedProjectId ?? ""))?.label ?? "Sin proyecto";

  function toggleCategory(categoryId: string) {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setError("Solo se permiten archivos PDF");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("El archivo no puede superar 10MB");
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  }

  async function onSubmit(data: z.input<typeof createTaskSchema>) {
    setError(null);

    const payload: CreateTaskInput = {
      title: data.title.trim(),
      priority: data.priority ?? "medium",
      recurrence: data.recurrence ?? "none",
      projectId: data.projectId || undefined,
      description: data.description,
      startDate: data.startDate,
      dueDate: data.dueDate,
      ...(selectedCategories.length > 0 && { categories: selectedCategories }),
    };

    setIsSubmitting(true);
    try {
      const result = await createTask(payload);
      if (!result.success) {
        setError(result.error);
        return;
      }

      if (selectedFile) {
        const uploadResult = await uploadTaskPdf(result.data.id, selectedFile);
        if (!uploadResult.success) {
          console.warn("PDF upload failed:", uploadResult.error);
        }
      }

      form.reset();
      setSelectedCategories([]);
      setSelectedFile(null);
      onCreated?.(result.data);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Título de la tarea"
              aria-label="Título de la tarea"
              autoFocus
              {...form.register("title")}
            />
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onCancel}
                aria-label="Cancelar"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          {form.formState.errors.title && (
            <p className="text-xs text-destructive">
              {form.formState.errors.title.message}
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            <Select
              items={PRIORITY_ITEMS}
              value={watchedPriority ?? "medium"}
              onValueChange={(value) =>
                form.setValue("priority", value as CreateTaskInput["priority"])
              }
            >
              <SelectTrigger className="w-full" aria-label="Prioridad">
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

            <Select
              items={projectItems}
              value={watchedProjectId ?? ""}
              onValueChange={(value) =>
                form.setValue("projectId", value || undefined)
              }
            >
              <SelectTrigger className="w-full" aria-label="Proyecto">
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

            <Input
              type="date"
              aria-label="Fecha de vencimiento"
              {...form.register("dueDate")}
            />
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: selectedCategories.includes(category.id)
                      ? category.color + "30"
                      : "transparent",
                    color: selectedCategories.includes(category.id)
                      ? category.color
                      : undefined,
                    borderColor: selectedCategories.includes(category.id)
                      ? category.color
                      : undefined,
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
          />

          {selectedFile ? (
            <div className="flex items-center gap-2 rounded-xl border border-border/60 p-3">
              <FileText className="h-4 w-4 text-primary" />
              <span className="flex-1 truncate text-sm font-medium">
                {selectedFile.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-dashed"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Adjuntar PDF
            </Button>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Crear tarea
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
