export interface ScheduleBlock {
  id: string;
  userId: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  color: string;
  pdfUrl: string | null;
  pdfName: string | null;
  createdAt: string;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const DAY_NAMES_SHORT = [
  "Dom",
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
] as const;

export const SCHEDULE_COLORS = [
  "#0b57d0",
  "#0d652d",
  "#c5221f",
  "#e37400",
  "#7b1fa2",
  "#00838f",
  "#ad1457",
  "#4e3524",
] as const;
