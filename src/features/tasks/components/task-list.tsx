"use client";

import { useState } from "react";
import { Plus, SquareCheckBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Project, Task, Category } from "@/types";
import type { AssignableUser } from "../queries";
import { CreateTaskForm } from "./create-task-form";
import { TaskCard } from "./task-card";

type TaskListProps = {
  tasks: Task[];
  projects?: Project[];
  categories?: Category[];
  assignees?: AssignableUser[];
  autoOpen?: boolean;
};

export function TaskList({
  tasks,
  projects = [],
  categories = [],
  assignees = [],
  autoOpen = false,
}: TaskListProps) {
  const [showForm, setShowForm] = useState(autoOpen);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tareas</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus data-icon="inline-start" />
            Crear tarea
          </Button>
        )}
      </div>

      {showForm && (
        <CreateTaskForm
          projects={projects}
          categories={categories}
          assignees={assignees}
          onCreated={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <SquareCheckBig className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No hay tareas</p>
            <p className="text-xs text-muted-foreground">
              Crea tu primera tarea para empezar a organizar el trabajo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
