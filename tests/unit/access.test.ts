import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/auth/session";

const state = vi.hoisted(() => ({
  rows: new Map<string, unknown[]>(),
  session: { uid: "owner-1", email: "a@b.co", displayName: "A", photoUrl: null },
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/db", () => {
  const name = Symbol.for("drizzle:Name");
  return {
    db: {
      select() {
        return {
          from(table: unknown) {
            const tableName = (table as { [k: symbol]: string | undefined })[
              name
            ] ?? "unknown";
            const builder: Record<string, unknown> = {
              rows: state.rows.get(tableName) ?? [],
              where() {
                return builder;
              },
              orderBy() {
                return builder;
              },
              limit(n: number) {
                builder.rows = (state.rows.get(tableName) ?? []).slice(0, n);
                return builder;
              },
              then(resolve: unknown) {
                return Promise.resolve(builder.rows).then(
                  resolve as (value: unknown) => unknown
                );
              },
            };
            return builder;
          },
        };
      },
    },
  };
});

const {
  getAccessibleProjectIds,
  getProjectAccess,
  requireProjectAccess,
  requireProjectOwner,
  requireTaskAccess,
} = await import("@/lib/access");

beforeEach(() => {
  state.rows.clear();
  state.session.uid = "owner-1";
  vi.mocked(requireSession).mockImplementation(async () => state.session);
});

describe("getProjectAccess", () => {
  it("owner: read-write sin ser miembro", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    const access = await getProjectAccess("p1", state.session);
    expect(access).toEqual({ role: "owner", readWrite: true });
  });

  it("editor: read-write por membresía", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    state.rows.set("project_members", [
      { projectId: "p1", userId: "editor-1", role: "editor" },
    ]);
    const access = await getProjectAccess("p1", {
      uid: "editor-1",
      email: "e@b.co",
      displayName: "E",
      photoUrl: null,
    });
    expect(access).toEqual({ role: "editor", readWrite: true });
  });

  it("viewer: solo lectura", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    state.rows.set("project_members", [
      { projectId: "p1", userId: "viewer-1", role: "viewer" },
    ]);
    const access = await getProjectAccess("p1", {
      uid: "viewer-1",
      email: "v@b.co",
      displayName: "V",
      photoUrl: null,
    });
    expect(access).toEqual({ role: "viewer", readWrite: false });
  });

  it("no miembro: null", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    const access = await getProjectAccess("p1", {
      uid: "x-1",
      email: "x@b.co",
      displayName: "X",
      photoUrl: null,
    });
    expect(access).toBeNull();
  });

  it("proyecto inexistente: null", async () => {
    expect(await getProjectAccess("no-existe", state.session)).toBeNull();
  });
});

describe("getAccessibleProjectIds", () => {
  it("une proyectos propios y compartidos (sin duplicados)", async () => {
    state.rows.set("projects", [{ id: "own-1" }, { id: "own-2" }]);
    state.rows.set("project_members", [
      { projectId: "shared-1", userId: "owner-1", role: "editor" },
      { projectId: "own-2", userId: "owner-1", role: "viewer" },
    ]);
    const ids = await getAccessibleProjectIds(state.session);
    expect([...ids].sort()).toEqual(["own-1", "own-2", "shared-1"]);
  });
});

describe("requireProjectAccess", () => {
  it("lanza NotFound si no tiene acceso", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    state.session.uid = "stranger-1";
    await expect(requireProjectAccess("p1")).rejects.toThrow(NotFoundError);
  });

  it("lanza Forbidden al pedir write como viewer", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    state.rows.set("project_members", [
      { projectId: "p1", userId: "viewer-1", role: "viewer" },
    ]);
    state.session.uid = "viewer-1";
    await expect(requireProjectAccess("p1", { write: true })).rejects.toThrow(
      ForbiddenError
    );
  });

  it("editor: write permitido", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    state.rows.set("project_members", [
      { projectId: "p1", userId: "editor-1", role: "editor" },
    ]);
    state.session.uid = "editor-1";
    await expect(requireProjectAccess("p1", { write: true })).resolves.toEqual({
      role: "editor",
      readWrite: true,
    });
  });
});

describe("requireProjectOwner", () => {
  it("owner: no lanza", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    await expect(requireProjectOwner("p1")).resolves.toBeUndefined();
  });

  it("editor miembro: lanza Forbidden", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    state.rows.set("project_members", [
      { projectId: "p1", userId: "editor-1", role: "editor" },
    ]);
    state.session.uid = "editor-1";
    await expect(requireProjectOwner("p1")).rejects.toThrow(ForbiddenError);
  });
});

describe("requireTaskAccess", () => {
  it("tarea propia: owner read-write aunque esté en proyecto ajeno", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    state.session.uid = "editor-1";
    const access = await requireTaskAccess({ userId: "editor-1", projectId: "p1" });
    expect(access).toEqual({ role: "owner", readWrite: true });
  });

  it("tarea en proyecto compartido como viewer: solo lectura", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    state.rows.set("project_members", [
      { projectId: "p1", userId: "viewer-1", role: "viewer" },
    ]);
    state.session.uid = "viewer-1";
    const access = await requireTaskAccess({
      userId: "owner-1",
      projectId: "p1",
    });
    expect(access).toEqual({ role: "viewer", readWrite: false });
  });

  it("tarea ajena sin proyecto: NotFound", async () => {
    await expect(
      requireTaskAccess({ userId: "other-1", projectId: null })
    ).rejects.toThrow(NotFoundError);
  });

  it("write como viewer: Forbidden", async () => {
    state.rows.set("projects", [{ id: "p1", userId: "owner-1" }]);
    state.rows.set("project_members", [
      { projectId: "p1", userId: "viewer-1", role: "viewer" },
    ]);
    state.session.uid = "viewer-1";
    await expect(
      requireTaskAccess({ userId: "owner-1", projectId: "p1" }, { write: true })
    ).rejects.toThrow(ForbiddenError);
  });
});