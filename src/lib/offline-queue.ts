import { openDB, type IDBPDatabase } from "idb";

import { updateTaskStatus } from "@/features/tasks/actions";
import type { Task } from "@/types";

const DB_NAME = "utp-offline-queue";
const DB_VERSION = 1;
const STORE = "pendingMutations";

/**
 * Reintentos antes de descartar una mutación que el servidor sigue
 * rechazando (no confundir con fallos de red: esos no cuentan como intento,
 * ver flushQueue).
 */
const MAX_ATTEMPTS = 5;

export type PendingStatusMutation = {
  id: string;
  taskId: string;
  status: Task["status"];
  baseUpdatedAt: string;
  createdAt: number;
  attempts: number;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB no disponible"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> };
};

/**
 * Background Sync es Chrome/Edge únicamente (no existe en Safari/iOS): se
 * usa solo como mejora progresiva para despertar el SW y avisar a las
 * pestañas abiertas antes de que el usuario vuelva a abrir la app. El
 * mecanismo portable de verdad son los listeners online/visibilitychange en
 * OfflineSyncProvider.
 */
async function registerBackgroundSync(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration =
      (await navigator.serviceWorker.ready) as SyncCapableRegistration;
    await registration.sync?.register("flush-task-queue");
  } catch {
    // no soportado o falló: no pasa nada, el flush online/visible cubre esto
  }
}

/**
 * Encola el estado final deseado para una tarea. Si ya había una mutación
 * pendiente para esa tarea la reemplaza en vez de apilar otra: dos cambios
 * offline seguidos comparten el mismo `baseUpdatedAt`, así que apilarlos
 * haría que el segundo chocara contra el primero al sincronizar y el usuario
 * vería un "conflicto" contra su propio cambio.
 */
export async function enqueueStatusMutation(input: {
  taskId: string;
  status: Task["status"];
  baseUpdatedAt: string;
}): Promise<void> {
  const db = await getDB();
  const pending = await getPendingMutations();
  const existing = pending.find((m) => m.taskId === input.taskId);

  const mutation: PendingStatusMutation = existing
    ? { ...existing, status: input.status }
    : {
        id: crypto.randomUUID(),
        taskId: input.taskId,
        status: input.status,
        baseUpdatedAt: input.baseUpdatedAt,
        createdAt: Date.now(),
        attempts: 0,
      };

  await db.put(STORE, mutation);
  await registerBackgroundSync();
}

export async function getPendingMutations(): Promise<PendingStatusMutation[]> {
  const db = await getDB();
  const all: PendingStatusMutation[] = await db.getAll(STORE);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

async function removeMutation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

async function bumpAttempts(mutation: PendingStatusMutation): Promise<void> {
  const db = await getDB();
  await db.put(STORE, { ...mutation, attempts: mutation.attempts + 1 });
}

export type FlushOutcome = {
  applied: PendingStatusMutation[];
  conflicts: PendingStatusMutation[];
  failed: PendingStatusMutation[];
};

let flushing = false;

/**
 * Aplica las mutaciones encoladas, en orden. Un fallo de RED detiene el
 * flush entero (seguimos offline, no tiene sentido seguir intentando ni
 * gastar "intentos" de las siguientes); solo se cuenta un intento cuando el
 * servidor sí respondió pero rechazó la mutación por algo que no es un
 * conflicto de versión.
 */
export async function flushQueue(): Promise<FlushOutcome> {
  const outcome: FlushOutcome = { applied: [], conflicts: [], failed: [] };
  if (flushing) return outcome;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return outcome;
  }

  flushing = true;
  try {
    const pending = await getPendingMutations();

    for (const mutation of pending) {
      let result;
      try {
        result = await updateTaskStatus(
          mutation.taskId,
          mutation.status,
          mutation.baseUpdatedAt
        );
      } catch {
        // Fallo de red: probablemente seguimos offline. El resto de la cola
        // se reintenta en el próximo flush (evento online/visibilitychange).
        break;
      }

      if (result.success) {
        await removeMutation(mutation.id);
        outcome.applied.push(mutation);
        continue;
      }

      if (result.code === "CONFLICT") {
        await removeMutation(mutation.id);
        outcome.conflicts.push(mutation);
        continue;
      }

      if (mutation.attempts + 1 >= MAX_ATTEMPTS) {
        await removeMutation(mutation.id);
        outcome.failed.push(mutation);
      } else {
        await bumpAttempts(mutation);
      }
    }
  } finally {
    flushing = false;
  }

  return outcome;
}

export type StatusChangeResult =
  | { outcome: "applied"; task: Task }
  | { outcome: "queued" }
  | { outcome: "error"; message: string };

function isLikelyOffline(error: unknown): boolean {
  return (
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    error instanceof TypeError
  );
}

/**
 * Cambia el estado de una tarea: camino feliz sin cambios (llamada directa a
 * la Server Action); si falla por red, la encola en vez de perder el cambio.
 * Los llamadores deben aplicar su propia actualización optimista de UI —
 * este módulo no conoce React.
 *
 * El clic directo va SIN `expectedUpdatedAt` a propósito: las props del
 * cliente pueden estar desactualizadas (el cron de Moodle o un colaborador
 * tocaron la tarea) y el usuario espera que marcar la casilla funcione igual.
 * El chequeo de versión solo aplica al reintentar desde la cola, donde sí
 * hace falta para no pisar a ciegas un cambio hecho mientras estabas offline.
 */
export async function applyTaskStatusChange(
  task: Pick<Task, "id" | "updatedAt">,
  status: Task["status"]
): Promise<StatusChangeResult> {
  try {
    const result = await updateTaskStatus(task.id, status);
    if (result.success) return { outcome: "applied", task: result.data };
    return { outcome: "error", message: result.error };
  } catch (error) {
    if (!isLikelyOffline(error)) {
      return { outcome: "error", message: "No se pudo actualizar la tarea" };
    }
    await enqueueStatusMutation({
      taskId: task.id,
      status,
      baseUpdatedAt: task.updatedAt,
    });
    return { outcome: "queued" };
  }
}
