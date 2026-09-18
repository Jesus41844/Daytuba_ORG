import { describe, expect, it } from "vitest";
import {
  buildReminderPayload,
  DUE_WINDOW_MS,
  formatReminderDate,
} from "@/lib/reminders";

const dueDate = new Date("2026-09-20T08:30:00Z");

function buildTask(overrides: Partial<{ id: string; title: string; dueDate: Date | null }> = {}) {
  return {
    id: overrides.id ?? "task-1",
    title: overrides.title ?? "Tarea final",
    dueDate: overrides.dueDate !== undefined ? overrides.dueDate : dueDate,
  };
}

describe("formatReminderDate", () => {
  it("formatea una fecha válida", () => {
    const out = formatReminderDate(dueDate);
    expect(out).toContain("2026");
    expect(out).toBeTruthy();
  });

  it("devuelve vacío con null/undefined/fecha inválida", () => {
    expect(formatReminderDate(null)).toBe("");
    expect(formatReminderDate(undefined)).toBe("");
    expect(formatReminderDate(new Date("invalid"))).toBe("");
  });
});

describe("buildReminderPayload", () => {
  it("construye el payload con fecha de vencimiento", () => {
    const payload = buildReminderPayload(buildTask());
    expect(payload.title).toBe("🔔 Tarea final");
    expect(payload.body).toContain("Vence el");
    expect(payload.path).toBe("/dashboard/tasks/task-1");
    expect(payload.subject).toContain("Tarea final");
    expect(payload.text).toContain("Tarea final");
    expect(payload.html).toContain("Abrir tarea en Daytuba Tasks");
  });

  it("sin fecha de vencimiento usa un aviso genérico", () => {
    const payload = buildReminderPayload(buildTask({ dueDate: null }));
    expect(payload.body).toBe("Tienes un recordatorio programado");
  });

  it("con baseUrl produce una URL absoluta en texto y html", () => {
    const payload = buildReminderPayload(buildTask(), {
      baseUrl: "https://daytuba-org.vercel.app",
    });
    expect(payload.url).toBe(
      "https://daytuba-org.vercel.app/dashboard/tasks/task-1"
    );
    expect(payload.text).toContain(payload.url);
    expect(payload.html).toContain(payload.url);
  });

  it("escapa HTML del título", () => {
    const payload = buildReminderPayload(buildTask({ title: '<img src=x onerror=1> "cita"' }));
    expect(payload.html).toContain("&lt;img");
    expect(payload.html).toContain("&quot;cita&quot;");
    expect(payload.html).not.toContain("<img");
  });
});

describe("DUE_WINDOW_MS", () => {
  it("es una ventana de un día", () => {
    expect(DUE_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});