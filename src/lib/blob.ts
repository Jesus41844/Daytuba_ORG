import { del, put } from "@vercel/blob";

export const PDF_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_SIZE_BYTES = 4 * 1024 * 1024;

const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

export function isBlobUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && BLOB_URL_RE.test(url);
}

export async function deleteBlobUrl(
  url: string | null | undefined
): Promise<void> {
  if (!isBlobUrl(url)) return;
  await del(url!).catch(() => {});
}

export async function putPublic(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const result = await put(key, body, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return result.url;
}