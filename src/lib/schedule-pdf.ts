import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ParsedScheduleEntry {
  subject: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface TextItem {
  str: string;
  x: number;
  y: number;
}

interface TimeSlot {
  start: string;
  end: string;
  y: number;
  yTop: number;
  yBottom: number;
}

interface DayColumn {
  day: number;
  xCenter: number;
}

function parseTimeLabel(label: string): { start: string; end: string } | null {
  const cleaned = label.replace(/\s+/g, "").toUpperCase();
  const match = cleaned.match(
    /(\d{1,2}):(\d{2})[-–](\d{1,2}):(\d{2})(A\.?M\.?|P\.?M\.?)/i
  );
  if (!match) return null;

  let startH = parseInt(match[1]!, 10);
  let endH = parseInt(match[3]!, 10);
  const startM = match[2];
  const endM = match[4];
  const meridian = match[5]!.replace(/\./g, "").toUpperCase();

  if (meridian === "PM" && startH < 12) startH += 12;
  if (meridian === "AM" && startH === 12) startH = 0;
  if (meridian === "PM" && endH < 12) endH += 12;
  if (meridian === "AM" && endH === 12) endH = 0;

  return {
    start: `${String(startH).padStart(2, "0")}:${startM}`,
    end: `${String(endH).padStart(2, "0")}:${endM}`,
  };
}

export async function parseSchedulePdfBuffer(
  buffer: ArrayBuffer
): Promise<ParsedScheduleEntry[]> {
  const tmpPath = join(tmpdir(), `schedule-pdf-${Date.now()}.pdf`);
  writeFileSync(tmpPath, Buffer.from(buffer));

  let raw: string;
  try {
    const scriptPath = join(process.cwd(), "scripts", "parse-schedule-pdf.cjs");
    raw = execFileSync(process.execPath, [scriptPath, tmpPath], {
      cwd: process.cwd(),
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf-8",
    });
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }

  const allItems: TextItem[] = JSON.parse(raw);

  const dayColumns = findDayColumns(allItems);
  const timeSlots = findTimeSlots(allItems);

  if (dayColumns.length === 0 || timeSlots.length === 0) {
    return fallbackPlainTextParse(allItems);
  }

  buildSlotBoundaries(timeSlots);

  const dayHeaders = new Set([
    "LUNES", "MARTES", "MIÉRCOLES", "MIERCOLES", "JUEVES",
    "VIERNES", "SÁBADO", "SABADO", "DOMINGO", "HORAS",
  ]);

  const entries: ParsedScheduleEntry[] = [];

  for (const slot of timeSlots) {
    for (const col of dayColumns) {
      const cellItems = allItems.filter((item) => {
        if (item.y < slot.yBottom || item.y > slot.yTop) return false;
        if (Math.abs(item.x - col.xCenter) > 50) return false;
        if (item.y > 670) return false;
        if (dayHeaders.has(item.str.trim().toUpperCase())) return false;
        return true;
      });

      const subject = extractSubjectFromCell(cellItems);
      if (subject) {
        entries.push({
          subject,
          dayOfWeek: col.day,
          startTime: slot.start,
          endTime: slot.end,
        });
      }
    }
  }

  const deduped = new Map<string, ParsedScheduleEntry>();
  for (const entry of entries) {
    const key = `${entry.subject}|${entry.dayOfWeek}|${entry.startTime}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });
}

function findDayColumns(items: TextItem[]): DayColumn[] {
  const dayPatterns: { regex: RegExp; day: number }[] = [
    { regex: /^LUNES$/i, day: 1 },
    { regex: /^MARTES$/i, day: 2 },
    { regex: /^MI[ÉE]RCOLES$/i, day: 3 },
    { regex: /^JUEVES$/i, day: 4 },
    { regex: /^VIERNES$/i, day: 5 },
    { regex: /^S[ÁA]BADO$/i, day: 6 },
    { regex: /^DOMINGO$/i, day: 0 },
  ];

  const columns: DayColumn[] = [];
  for (const item of items) {
    for (const { regex, day } of dayPatterns) {
      if (regex.test(item.str.trim())) {
        columns.push({ day, xCenter: item.x });
        break;
      }
    }
  }
  return columns.sort((a, b) => a.xCenter - b.xCenter);
}

function findTimeSlots(items: TextItem[]): TimeSlot[] {
  const slots: TimeSlot[] = [];

  for (const item of items) {
    if (item.x > 80) continue;
    const parsed = parseTimeLabel(item.str);
    if (parsed) {
      slots.push({ start: parsed.start, end: parsed.end, y: item.y, yTop: 0, yBottom: 0 });
    }
  }

  return slots.sort((a, b) => b.y - a.y);
}

function buildSlotBoundaries(slots: TimeSlot[]): void {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    if (i === 0) {
      slot.yTop = slot.y + 20;
    } else {
      slot.yTop = (slot.y + slots[i - 1]!.y) / 2;
    }
    if (i === slots.length - 1) {
      slot.yBottom = slot.y - 35;
    } else {
      slot.yBottom = (slot.y + slots[i + 1]!.y) / 2;
    }
  }
}

function extractSubjectFromCell(items: TextItem[]): string | null {
  const fragments: string[] = [];
  for (const item of items) {
    const cleaned = item.str.trim();
    if (cleaned.length < 2) continue;
    if (/^aula\s/i.test(cleaned)) continue;
    if (/^\(l\)$/i.test(cleaned) || /^\(b\)$/i.test(cleaned)) continue;
    if (/^(a\.?m\.?|p\.?m\.?|\.|\s)*$/i.test(cleaned)) continue;
    fragments.push(cleaned);
  }

  if (fragments.length === 0) return null;

  let subject = fragments
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*/g, ".")
    .trim();

  subject = subject.replace(/\s*\(L\)\s*/gi, "").trim();
  subject = subject.replace(/\s*\(B\)\s*/gi, "").trim();

  return subject.length >= 2 ? subject.toUpperCase() : null;
}

function fallbackPlainTextParse(items: TextItem[]): ParsedScheduleEntry[] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines: string[] = [];
  let currentLine = "";
  let currentY = sorted[0]?.y ?? 0;

  for (const item of sorted) {
    if (Math.abs(item.y - currentY) > 15) {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = "";
      currentY = item.y;
    }
    currentLine += " " + item.str;
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  const entries: ParsedScheduleEntry[] = [];
  const dayMap: Record<string, number> = {
    lunes: 1, martes: 2, miercoles: 3, jueves: 4,
    viernes: 5, sabado: 6, domingo: 0,
  };

  for (const line of lines) {
    const lower = line.toLowerCase();
    let day: number | null = null;
    for (const [name, num] of Object.entries(dayMap)) {
      if (lower.includes(name)) { day = num; break; }
    }

    const timeMatch = line.match(
      /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i
    );
    if (day !== null && timeMatch) {
      let subject = line;
      for (const name of Object.keys(dayMap)) {
        subject = subject.replace(new RegExp(name, "gi"), "");
      }
      subject = subject
        .replace(/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/gi, "")
        .replace(/[,\s]+/g, " ")
        .trim();
      if (subject.length >= 2) {
        entries.push({
          subject,
          dayOfWeek: day,
          startTime: `${timeMatch[1]!.padStart(2, "0")}:${timeMatch[2]}`,
          endTime: `${timeMatch[3]!.padStart(2, "0")}:${timeMatch[4]}`,
        });
      }
    }
  }

  return entries;
}
