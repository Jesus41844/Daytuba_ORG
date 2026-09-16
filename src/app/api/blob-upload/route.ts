import { issueSignedToken, presignUrl } from "@vercel/blob";
import type { HandleUploadPresignedBody } from "@vercel/blob/client";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { scheduleBlocks, tasks } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { PDF_MAX_SIZE_BYTES } from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadKind = "task" | "schedule";

interface ClientPayload {
  kind: UploadKind;
  id: string;
}

function prefixFor(kind: UploadKind, id: string): string {
  return kind === "task" ? `uploads/tasks/${id}/` : `uploads/schedule/${id}/`;
}

async function getSignedToken(
  pathname: string,
  clientPayload: string | null
) {
  const session = await requireSession();

  let payload: ClientPayload;
  try {
    payload = JSON.parse(clientPayload ?? "{}") as ClientPayload;
  } catch {
    throw new Error("Carga inválida");
  }

  if (!payload || (payload.kind !== "task" && payload.kind !== "schedule")) {
    throw new Error("Tipo de archivo inválido");
  }

  if (payload.kind === "task") {
    const rows = await db
      .select({ userId: tasks.userId })
      .from(tasks)
      .where(eq(tasks.id, payload.id))
      .limit(1);
    if (!rows[0]) throw new Error("La tarea no existe");
    if (rows[0].userId !== session.uid) throw new Error("No autorizado");
  } else {
    const rows = await db
      .select({ userId: scheduleBlocks.userId })
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.id, payload.id))
      .limit(1);
    if (!rows[0]) throw new Error("El bloque no existe");
    if (rows[0].userId !== session.uid) throw new Error("No autorizado");
  }

  if (!pathname.startsWith(prefixFor(payload.kind, payload.id))) {
    throw new Error("Ruta inválida");
  }
  if (!/\.pdf$/i.test(pathname)) {
    throw new Error("Solo se permiten archivos PDF");
  }

  const token = await issueSignedToken({
    pathname,
    operations: ["put"],
    allowedContentTypes: ["application/pdf"],
    maximumSizeInBytes: PDF_MAX_SIZE_BYTES,
    validUntil: Date.now() + 10 * 60 * 1000,
  });

  return { token };
}

export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadPresignedBody;
  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return NextResponse.json({ error: "Carga inválida" }, { status: 400 });
  }

  if (body.type !== "blob.generate-presigned-url") {
    return NextResponse.json(
      { error: "Tipo de evento inválido" },
      { status: 400 }
    );
  }

  const { pathname, clientPayload, multipart } = body.payload;
  if (multipart) {
    return NextResponse.json(
      { error: "Subida multipart no soportada" },
      { status: 400 }
    );
  }

  try {
    const { token } = await getSignedToken(pathname, clientPayload);
    const { presignedUrl } = await presignUrl(token, {
      operation: "put",
      pathname,
      access: "public",
    });
    return NextResponse.json({
      type: body.type,
      presignedUrlPayload: { presignedUrl },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al subir el archivo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}