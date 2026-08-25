import { describe, expect, it } from "vitest";
import {
  createTaskSchema,
  loginSchema,
  registerSchema,
  updateTaskSchema,
} from "@/lib/validations";

describe("loginSchema", () => {
  it("acepta credenciales válidas", () => {
    const r = loginSchema.safeParse({
      email: "test@utp.ac.pa",
      password: "secreto123",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza email inválido", () => {
    const r = loginSchema.safeParse({
      email: "no-es-email",
      password: "secreto123",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza password corto", () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "123" });
    expect(r.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("rechaza cuando confirmPassword difiere", () => {
    const r = registerSchema.safeParse({
      email: "test@utp.ac.pa",
      displayName: "Test",
      password: "secreto123",
      confirmPassword: "distinta123",
    });
    expect(r.success).toBe(false);
  });

  it("acepta registro válido", () => {
    const r = registerSchema.safeParse({
      email: "test@utp.ac.pa",
      displayName: "Test",
      password: "secreto123",
      confirmPassword: "secreto123",
    });
    expect(r.success).toBe(true);
  });
});

describe("createTaskSchema", () => {
  const base = { title: "Tarea" };

  it("acepta tarea sin proyecto (inbox)", () => {
    expect(createTaskSchema.safeParse(base).success).toBe(true);
  });

  it("no acepta projectId vacío", () => {
    expect(
      createTaskSchema.safeParse({ ...base, projectId: "" }).success,
    ).toBe(false);
  });

  it("mantiene la fecha como string ISO", () => {
    const r = createTaskSchema.parse({ ...base, dueDate: "2030-01-15" });
    expect(r.dueDate).toBe("2030-01-15");
    expect(r.priority).toBe("medium");
    expect(r.recurrence).toBe("none");
  });

  it("updateTaskSchema rechaza status fuera del enum", () => {
    expect(
      updateTaskSchema.safeParse({ status: "archivado" }).success,
    ).toBe(false);
    expect(
      updateTaskSchema.safeParse({ status: "in_progress" }).success,
    ).toBe(true);
  });
});
