const PDF_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export interface BlobUploadOk {
  success: true;
  data: { url: string; name: string };
}

export type BlobUploadResult =
  | BlobUploadOk
  | { success: false; error: string | null };

async function getPresignedPutUrl(
  pathname: string,
  clientPayload: string
): Promise<string> {
  const res = await fetch("/api/blob-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "blob.generate-presigned-url",
      payload: { pathname, clientPayload, multipart: false },
    }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) detail = String(data.error);
    } catch {
      // ignore parse errors, keep status fallback
    }
    throw new Error(`No se pudo obtener la URL de subida: ${detail}`);
  }

  const data = (await res.json()) as {
    presignedUrlPayload?: { presignedUrl?: string };
  };
  const presignedUrl = data?.presignedUrlPayload?.presignedUrl;
  if (!presignedUrl) {
    throw new Error("Respuesta de subida inválida");
  }
  return presignedUrl;
}

export async function uploadPdfToBlob(opts: {
  file: File;
  pathname: string;
  clientPayload: string;
  confirm: (
    url: string,
    name: string
  ) => Promise<{ success: boolean; error?: string | null }>;
}): Promise<BlobUploadResult> {
  const { file, pathname, clientPayload, confirm } = opts;

  if (file.type !== "application/pdf") {
    return { success: false, error: "Solo se permiten archivos PDF" };
  }
  if (file.size > PDF_MAX_SIZE_BYTES) {
    return { success: false, error: "El archivo no puede superar 10MB" };
  }

  try {
    const presignedUrl = await getPresignedPutUrl(pathname, clientPayload);

    const put = await fetch(presignedUrl, {
      method: "PUT",
      body: file,
      headers: { "content-type": "application/pdf" },
    });
    if (!put.ok) {
      throw new Error(`Subida fallida (HTTP ${put.status})`);
    }

    const blob = (await put.json()) as { url: string };

    const confirmResult = await confirm(blob.url, file.name);
    if (!confirmResult.success) {
      return {
        success: false,
        error: confirmResult.error ?? "Error al registrar el archivo",
      };
    }

    return { success: true, data: { url: blob.url, name: file.name } };
  } catch (error) {
    console.error("Error uploading PDF to blob:", error);
    return { success: false, error: "Error al subir el archivo" };
  }
}