export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string;

  date: string | null;
  dayOfWeek: number | null;

  createdAt: string;
}

export const EVENT_COLORS = [
  "#0b57d0",
  "#0d652d",
  "#c5221f",
  "#e37400",
  "#7b1fa2",
  "#00838f",
  "#ad1457",
  "#4e3524",
] as const;
