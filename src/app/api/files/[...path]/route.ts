import { createReadStream, existsSync, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { scheduleBlocks, tasks } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

function uploadsRoot(): string {
  const configured = process.env.UPLOADS_DIR;
  if (!configured) throw new Error("UPLOADS_DIR no está configurada");
  return path.resolve(configured);
}

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { path: segments } = await params;

  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  const kind = segments[0];

  // Profiles: /api/files/profiles/{userId} — user can only access their own
  if (kind === "profiles") {
    const userId = segments[1];
    if (userId !== session.uid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const root = uploadsRoot();
    const profileDir = path.join(root, "profiles");

    try {
      const { readdirSync } = await import("node:fs");
      const files = readdirSync(profileDir);
      const match = files.find((f) => {
        const ext = path.extname(f);
        return path.basename(f, ext) === userId;
      });

      if (!match) {
        return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
      }

      const absolutePath = path.join(profileDir, match);
      const ext = path.extname(match).toLowerCase();
      const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

      const stats = await stat(absolutePath);
      const stream = Readable.toWeb(
        createReadStream(absolutePath)
      ) as unknown as ReadableStream;

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(stats.size),
          "Cache-Control": "private, max-age=86400",
        },
      });
    } catch {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }
  }

  // Tasks / Schedule: /api/files/{kind}/{ownerId}/{...fileName}
  if (segments.length < 3) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  const ownerId = segments[1];
  const fileName = segments.slice(2).join("/");

  try {
    if (kind === "tasks") {
      const rows = await db
        .select({ userId: tasks.userId })
        .from(tasks)
        .where(eq(tasks.id, ownerId))
        .limit(1);
      if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      if (rows[0].userId !== session.uid) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    } else if (kind === "schedule") {
      const rows = await db
        .select({ userId: scheduleBlocks.userId })
        .from(scheduleBlocks)
        .where(eq(scheduleBlocks.id, ownerId))
        .limit(1);
      if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      if (rows[0].userId !== session.uid) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error verifying file ownership:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  const root = uploadsRoot();
  const absolutePath = path.resolve(root, kind, ownerId, fileName);

  if (!absolutePath.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

  const stats = await stat(absolutePath);
  const stream = Readable.toWeb(
    createReadStream(absolutePath)
  ) as unknown as ReadableStream;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      "Content-Disposition": `inline; filename="${path.basename(fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
