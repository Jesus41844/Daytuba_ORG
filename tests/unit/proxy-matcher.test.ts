import { describe, expect, it } from "vitest";

import { config } from "@/proxy";

// El matcher decide si el proxy llega a correr. Las rutas de cron se
// autentican con el header Authorization, así que si el proxy las intercepta
// las manda a /login con un 307 y el barrido nunca se ejecuta.
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("matcher del proxy", () => {
  it("deja pasar las rutas de cron sin interceptarlas", () => {
    expect(matcher.test("/api/cron/reminders")).toBe(false);
    expect(matcher.test("/api/cron/moodle-sync")).toBe(false);
  });

  it("sigue sin interceptar auth ni estáticos", () => {
    expect(matcher.test("/api/auth/clear-session")).toBe(false);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
    expect(matcher.test("/icons/icon-192.png")).toBe(false);
  });

  it("sigue protegiendo las páginas y el resto de la API", () => {
    expect(matcher.test("/dashboard")).toBe(true);
    expect(matcher.test("/dashboard/tasks")).toBe(true);
    expect(matcher.test("/api/push/subscribe")).toBe(true);
    expect(matcher.test("/api/blob-upload")).toBe(true);
  });
});
