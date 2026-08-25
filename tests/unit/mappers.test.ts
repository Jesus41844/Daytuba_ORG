import { describe, expect, it } from "vitest";
import {
  parseMoodlePlatform,
  parseTaskPriority,
  parseTaskRecurrence,
  parseTaskSource,
  parseTaskStatus,
  toDateOrNull,
} from "@/db/mappers";

describe("toDateOrNull", () => {
  it("convierte string a Date", () => {
    expect(toDateOrNull("2030-05-01")).toBeInstanceOf(Date);
  });

  it("devuelve null para null/undefined/vacío", () => {
    expect(toDateOrNull(null)).toBeNull();
    expect(toDateOrNull(undefined)).toBeNull();
    expect(toDateOrNull("")).toBeNull();
  });
});

describe("parseTaskStatus", () => {
  it("mapea estados válidos", () => {
    expect(parseTaskStatus("in_progress")).toBe("in_progress");
    expect(parseTaskStatus("completed")).toBe("completed");
  });

  it("hace fallback a pending con valor desconocido", () => {
    expect(parseTaskStatus("cualquier-cosa")).toBe("pending");
  });
});

describe("parseTaskPriority", () => {
  it("mapea prioridades válidas", () => {
    expect(parseTaskPriority("high")).toBe("high");
  });

  it("hace fallback a medium", () => {
    expect(parseTaskPriority("urgente!!")).toBe("medium");
  });
});

describe("parseTaskRecurrence", () => {
  it("mapea recurrencias válidas", () => {
    expect(parseTaskRecurrence("weekly")).toBe("weekly");
  });

  it("devuelve null para sin recurrencia o valor desconocido", () => {
    expect(parseTaskRecurrence(undefined as unknown as string)).toBeNull();
    expect(parseTaskRecurrence("cada-2-lunas")).toBeNull();
  });
});

describe("parseMoodlePlatform", () => {
  it("reconoce plataformas soportadas", () => {
    expect(parseMoodlePlatform("ecampus")).toBe("ecampus");
    expect(parseMoodlePlatform(null)).toBeNull();
  });

  it("rechaza plataforma desconocida", () => {
    expect(parseMoodlePlatform("blackboard")).toBeNull();
  });
});

describe("parseTaskSource", () => {
  it("hace fallback a manual", () => {
    expect(parseTaskSource("moodle")).toBe("moodle");
    expect(parseTaskSource(null)).toBe("manual");
  });
});
