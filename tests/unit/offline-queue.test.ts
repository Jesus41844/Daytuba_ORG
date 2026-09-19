import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateTaskStatus = vi.fn();

vi.mock("@/features/tasks/actions", () => ({
  updateTaskStatus: (...args: unknown[]) => updateTaskStatus(...args),
}));

const {
  applyTaskStatusChange,
  enqueueStatusMutation,
  flushQueue,
  getPendingMutations,
} = await import("@/lib/offline-queue");

const TASK = { id: "task-1", updatedAt: "2026-09-19T10:00:00.000Z" };

// Limpia el store en vez de borrar la base: el módulo mantiene su propia
// conexión abierta y deleteDB se quedaría bloqueado esperando a que cierre.
async function drainQueue() {
  const { openDB } = await import("idb");
  const db = await openDB("utp-offline-queue", 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("pendingMutations")) {
        database.createObjectStore("pendingMutations", { keyPath: "id" });
      }
    },
  });
  await db.clear("pendingMutations");
  db.close();
}

describe("cola de mutaciones offline", () => {
  beforeEach(async () => {
    updateTaskStatus.mockReset();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await drainQueue();
  });

  it("encola una mutación y la expone como pendiente", async () => {
    await enqueueStatusMutation({
      taskId: TASK.id,
      status: "completed",
      baseUpdatedAt: TASK.updatedAt,
    });

    const pending = await getPendingMutations();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      taskId: TASK.id,
      status: "completed",
      baseUpdatedAt: TASK.updatedAt,
      attempts: 0,
    });
  });

  it("fusiona dos cambios offline de la misma tarea en una sola mutación", async () => {
    await enqueueStatusMutation({
      taskId: TASK.id,
      status: "completed",
      baseUpdatedAt: TASK.updatedAt,
    });
    await enqueueStatusMutation({
      taskId: TASK.id,
      status: "pending",
      baseUpdatedAt: TASK.updatedAt,
    });

    const pending = await getPendingMutations();
    expect(pending).toHaveLength(1);
    // Gana el último estado, contra la versión que el usuario tenía al inicio.
    expect(pending[0]).toMatchObject({
      status: "pending",
      baseUpdatedAt: TASK.updatedAt,
    });
  });

  it("aplica la mutación y la saca de la cola cuando el servidor acepta", async () => {
    updateTaskStatus.mockResolvedValue({ success: true, data: { id: TASK.id } });
    await enqueueStatusMutation({
      taskId: TASK.id,
      status: "completed",
      baseUpdatedAt: TASK.updatedAt,
    });

    const outcome = await flushQueue();

    expect(updateTaskStatus).toHaveBeenCalledWith(
      TASK.id,
      "completed",
      TASK.updatedAt
    );
    expect(outcome.applied).toHaveLength(1);
    expect(await getPendingMutations()).toHaveLength(0);
  });

  it("descarta la mutación ante un conflicto de versión en vez de reintentar para siempre", async () => {
    updateTaskStatus.mockResolvedValue({
      success: false,
      error: "Esta tarea cambió en el servidor desde tu última edición.",
      code: "CONFLICT",
    });
    await enqueueStatusMutation({
      taskId: TASK.id,
      status: "completed",
      baseUpdatedAt: TASK.updatedAt,
    });

    const outcome = await flushQueue();

    expect(outcome.conflicts).toHaveLength(1);
    expect(outcome.applied).toHaveLength(0);
    expect(await getPendingMutations()).toHaveLength(0);
  });

  it("conserva la mutación (sin gastar intentos) si falla la red", async () => {
    updateTaskStatus.mockRejectedValue(new TypeError("Failed to fetch"));
    await enqueueStatusMutation({
      taskId: TASK.id,
      status: "completed",
      baseUpdatedAt: TASK.updatedAt,
    });

    const outcome = await flushQueue();

    expect(outcome.applied).toHaveLength(0);
    expect(outcome.failed).toHaveLength(0);
    const pending = await getPendingMutations();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.attempts).toBe(0);
  });

  it("descarta la mutación tras agotar los reintentos con errores del servidor", async () => {
    updateTaskStatus.mockResolvedValue({
      success: false,
      error: "Ocurrió un error inesperado",
    });
    await enqueueStatusMutation({
      taskId: TASK.id,
      status: "completed",
      baseUpdatedAt: TASK.updatedAt,
    });

    for (let i = 0; i < 4; i++) {
      const outcome = await flushQueue();
      expect(outcome.failed).toHaveLength(0);
      expect(await getPendingMutations()).toHaveLength(1);
    }

    const last = await flushQueue();
    expect(last.failed).toHaveLength(1);
    expect(await getPendingMutations()).toHaveLength(0);
  });

  it("no toca la cola cuando el navegador está offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await enqueueStatusMutation({
      taskId: TASK.id,
      status: "completed",
      baseUpdatedAt: TASK.updatedAt,
    });

    const outcome = await flushQueue();

    expect(updateTaskStatus).not.toHaveBeenCalled();
    expect(outcome.applied).toHaveLength(0);
    expect(await getPendingMutations()).toHaveLength(1);
  });
});

describe("applyTaskStatusChange", () => {
  beforeEach(async () => {
    updateTaskStatus.mockReset();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await drainQueue();
  });

  it("aplica directo cuando hay conexión, sin encolar", async () => {
    updateTaskStatus.mockResolvedValue({ success: true, data: { id: TASK.id } });

    const result = await applyTaskStatusChange(TASK, "completed");

    expect(result).toMatchObject({ outcome: "applied" });
    expect(await getPendingMutations()).toHaveLength(0);
  });

  it("no manda expectedUpdatedAt en el clic directo (props viejas no deben fallar)", async () => {
    updateTaskStatus.mockResolvedValue({ success: true, data: { id: TASK.id } });

    await applyTaskStatusChange(TASK, "completed");

    // Solo los reintentos desde la cola llevan chequeo de versión.
    expect(updateTaskStatus).toHaveBeenCalledWith(TASK.id, "completed");
  });

  it("encola el cambio cuando la llamada falla por red", async () => {
    updateTaskStatus.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await applyTaskStatusChange(TASK, "completed");

    expect(result).toEqual({ outcome: "queued" });
    const pending = await getPendingMutations();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      taskId: TASK.id,
      status: "completed",
      baseUpdatedAt: TASK.updatedAt,
    });
  });

  it("reporta error sin encolar cuando el servidor rechaza estando online", async () => {
    updateTaskStatus.mockResolvedValue({
      success: false,
      error: "No tienes permisos de edición en esta tarea",
    });

    const result = await applyTaskStatusChange(TASK, "completed");

    expect(result).toMatchObject({
      outcome: "error",
      message: "No tienes permisos de edición en esta tarea",
    });
    expect(await getPendingMutations()).toHaveLength(0);
  });
});
