export function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function taskPdfPathname(taskId: string, fileName: string): string {
  return `uploads/tasks/${taskId}/${crypto.randomUUID()}_${safeFileName(fileName)}`;
}

export function schedulePdfPathname(blockId: string, fileName: string): string {
  return `uploads/schedule/${blockId}/${crypto.randomUUID()}_${safeFileName(fileName)}`;
}