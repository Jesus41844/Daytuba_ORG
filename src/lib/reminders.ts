export const DUE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ReminderTaskSource = {
  id: string;
  title: string;
  dueDate: Date | null;
};

export type ReminderPayload = {
  title: string;
  body: string;
  url: string;
  path: string;
  subject: string;
  text: string;
  html: string;
};

export function formatReminderDate(
  value: Date | null | undefined
): string {
  if (!value || !Number.isFinite(value.getTime())) return "";
  return new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function buildReminderPayload(
  task: ReminderTaskSource,
  options?: { baseUrl?: string }
): ReminderPayload {
  const baseUrl = options?.baseUrl ?? "";
  const path = `/dashboard/tasks/${task.id}`;
  const url = `${baseUrl}${path}`;
  const date = formatReminderDate(task.dueDate);
  const dueLine = date ? `Vence el ${date}` : "Tienes un recordatorio programado";
  const subject = `⏰ Recordatorio: ${task.title}`;
  const text = `${task.title}\n${dueLine}\n\nÁbrela en Daytuba Tasks: ${url}`;
  const escapedTitle = escapeHtml(task.title);
  const html = `
<h2>Recordatorio</h2>
<p><strong>${escapedTitle}</strong></p>
<p>${escapeHtml(dueLine)}</p>
<p><a href="${url}">Abrir tarea en Daytuba Tasks</a></p>
`;
  return {
    title: `🔔 ${task.title}`,
    body: dueLine,
    url,
    path,
    subject,
    text,
    html,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getAppBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionUrl) return `https://${productionUrl}`;
  return "http://localhost:3000";
}