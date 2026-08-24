"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Category } from "@/types";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "../actions";

const CATEGORY_COLORS = [
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

type CategoryManagerProps = {
  categories: Category[];
};

export function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]!);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }

    startTransition(async () => {
      const result = await createCategory({ name: name.trim(), color });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setName("");
      setColor(CATEGORY_COLORS[0]!);
      setIsAdding(false);
      router.refresh();
    });
  }

  function handleDelete(categoryId: string) {
    setDeletePendingId(categoryId);
    startTransition(async () => {
      await deleteCategory(categoryId);
      setDeletePendingId(null);
      router.refresh();
    });
  }

  function startEditing(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  }

  function handleUpdate(categoryId: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      const result = await updateCategory(categoryId, {
        name: editName.trim(),
        color: editColor,
      });
      if (!result.success) return;
      cancelEditing();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categorías</h2>
        {!isAdding && (
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
            <Plus data-icon="inline-start" />
            Crear categoría
          </Button>
        )}
      </div>

      {isAdding && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre de la categoría (ej: FISC, Personal)"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsAdding(false);
                    setName("");
                    setError(null);
                  }}
                  aria-label="Cancelar"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="size-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? "currentColor" : "transparent",
                    }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Crear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tienes categorías creadas. Las categorías te ayudan a organizar tus tareas por tema.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="gap-2 py-3">
              <CardContent className="flex items-center gap-3 px-3">
                {editingId === category.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 flex-1 text-sm"
                      autoFocus
                    />
                    <div className="flex shrink-0 gap-0.5">
                      {CATEGORY_COLORS.map((c) => (
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
                      onClick={() => handleUpdate(category.id)}
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
                  </>
                ) : (
                  <>
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {category.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => startEditing(category)}
                      aria-label={`Editar categoría ${category.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      disabled={isPending && deletePendingId === category.id}
                      onClick={() => handleDelete(category.id)}
                      aria-label={`Eliminar categoría ${category.name}`}
                    >
                      {deletePendingId === category.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
