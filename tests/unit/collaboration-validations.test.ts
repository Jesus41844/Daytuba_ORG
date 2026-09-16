import { describe, expect, it } from "vitest";
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  createCommentSchema,
} from "@/lib/validations";

describe("inviteMemberSchema", () => {
  it("acepta invitación de editor", () => {
    const r = inviteMemberSchema.safeParse({
      projectId: "proj-1",
      email: "ana@utp.ac.pa",
      role: "editor",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.role).toBe("editor");
  });

  it("asigna viewer por defecto", () => {
    const r = inviteMemberSchema.safeParse({
      projectId: "proj-1",
      email: "ana@utp.ac.pa",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.role).toBe("viewer");
  });

  it("rechaza email inválido", () => {
    const r = inviteMemberSchema.safeParse({
      projectId: "proj-1",
      email: "no-es-email",
      role: "viewer",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza rol desconocido", () => {
    const r = inviteMemberSchema.safeParse({
      projectId: "proj-1",
      email: "ana@utp.ac.pa",
      role: "admin",
    });
    expect(r.success).toBe(false);
  });
});

describe("updateMemberRoleSchema", () => {
  it("acepta rol válido", () => {
    const r = updateMemberRoleSchema.safeParse({
      projectId: "proj-1",
      memberUserId: "user-2",
      role: "viewer",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza rol owner (no editável)", () => {
    const r = updateMemberRoleSchema.safeParse({
      projectId: "proj-1",
      memberUserId: "user-2",
      role: "owner",
    });
    expect(r.success).toBe(false);
  });
});

describe("createCommentSchema", () => {
  it("acepta comentario válido", () => {
    const r = createCommentSchema.safeParse({
      taskId: "task-1",
      body: "Mirando esto",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza comentario vacío", () => {
    const r = createCommentSchema.safeParse({
      taskId: "task-1",
      body: "   ",
    });
    expect(r.success).toBe(false);
  });
});