import { describe, expect, it } from "vitest";

import { moodleEventToTask } from "@/features/moodle/lib/parser";
import type { MoodleCourse, MoodleEvent } from "@/features/moodle/types";

const baseEvent: MoodleEvent = {
  id: 101,
  name: "Entrega del proyecto",
  description: "Entrega final",
  modulename: "assign",
  courseid: 7,
  timestart: 1789000000,
  timedue: 1789100000,
  url: "https://ecampus.utp.ac.pa/moodle/mod/assign/view.php?id=101",
};

describe("moodleEventToTask", () => {
  it("usa el shortname del curso en el título", () => {
    const course: MoodleCourse = {
      id: 7,
      shortname: "CAL1",
      fullname: "Cálculo I",
      categoryid: 2,
    };
    const task = moodleEventToTask(baseEvent, course, "ecampus", "user-1", null);
    expect(task.title).toBe("[CAL1] Tarea: Entrega del proyecto");
    expect(task.moodleCourseId).toBe("7");
    expect(task.projectId).toBeNull();
  });

  it("usa el fallback 'Curso N' cuando no hay curso mapeado", () => {
    const task = moodleEventToTask(baseEvent, undefined, "ecampus", "user-1");
    expect(task.title).toBe("[Curso 7] Tarea: Entrega del proyecto");
    expect(task.moodleCourseId).toBe("7");
  });

  it("usa 'Sin curso' cuando el evento no tiene courseid", () => {
    const event: MoodleEvent = { ...baseEvent, courseid: null };
    const task = moodleEventToTask(event, undefined, "ecampus", "user-1");
    expect(task.title).toBe("[Sin curso] Tarea: Entrega del proyecto");
    expect(task.moodleCourseId).toBeNull();
    expect(task.projectId).toBeNull();
  });

  it("no produce 'Curso undefined' bajo ninguna circunstancia", () => {
    const event: MoodleEvent = {
      ...baseEvent,
      courseid: undefined as unknown as null,
    };
    const task = moodleEventToTask(event, undefined, "ecampus", "user-1");
    expect(task.title).not.toContain("undefined");
  });
});