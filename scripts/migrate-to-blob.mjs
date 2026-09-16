import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

import { put } from "@vercel/blob";
import postgres from "postgres";

function loadEnvFile(file) {
  const result = {};
  if (!existsSync(file)) return result;
  const content = readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const env = {
  ...loadEnvFile(".env.local"),
  ...loadEnvFile(".env"),
  ...process.env,
};

const DATABASE_URL = env.DATABASE_URL;
const RW_TOKEN = env.BLOB_READ_WRITE_TOKEN;
const UPLOADS_DIR = env.UPLOADS_LOCAL_DIR ?? "./uploads";

if (!DATABASE_URL) {
  console.error("Falta DATABASE_URL (URL destino, p.ej. Render Postgres).");
  process.exit(1);
}
if (!RW_TOKEN) {
  console.error("Falta BLOB_READ_WRITE_TOKEN.");
  process.exit(1);
}

const MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function mimeFor(file) {
  return MIME_BY_EXT[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

async function upload(key, localPath, contentType) {
  if (!existsSync(localPath)) return { ok: false, reason: `archivo no encontrado: ${localPath}` };
  const buffer = readFileSync(localPath);
  const result = await put(key, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    token: RW_TOKEN,
  });
  return { ok: true, url: result.url };
}

function profilesMatch(uploadsRoot) {
  const profilesDir = path.join(uploadsRoot, "profiles");
  if (!existsSync(profilesDir)) return new Map();
  const map = new Map();
  for (const file of readdirSync(profilesDir)) {
    const ext = path.extname(file);
    map.set(path.basename(file, ext), path.join(profilesDir, file));
  }
  return map;
}

async function main() {
  const sql = postgres(DATABASE_URL, { max: 4 });
  const usageStart = process.memoryUsage().heapUsed;
  let uploaded = 0;
  let skipped = 0;
  const errors = [];

  const profileFiles = profilesMatch(UPLOADS_DIR);

  const users = await sql`SELECT id, photo_url FROM users WHERE photo_url LIKE '/api/files/%'`;
  for (const row of users) {
    const uid = row.id;
    const localPath = profileFiles.get(uid);
    if (!localPath) {
      skipped++;
      console.warn(`[users] foto de ${uid}: no hay archivo local`);
      continue;
    }
    try {
      const { ok, url, reason } = await upload(`uploads/profiles/${path.basename(localPath)}`, localPath, mimeFor(localPath));
      if (!ok) {
        skipped++;
        console.warn(`[users] ${uid}: ${reason}`);
        continue;
      }
      await sql`UPDATE users SET photo_url = ${url} WHERE id = ${uid}`;
      uploaded++;
      console.log(`[users] ${uid} -> ${url}`);
    } catch (error) {
      errors.push(`[users] ${uid}: ${error.message}`);
    }
  }

  for (const kind of ["tasks", "schedule"]) {
    const table = kind === "tasks" ? "tasks" : "schedule_blocks";
    const rows = await sql`SELECT id, pdf_url FROM ${sql(table)} WHERE pdf_url LIKE '/api/files/%'`;
    for (const row of rows) {
      const legacy = row.pdf_url; // /api/files/{kind}/{ownerId}/{rest}
      const relative = legacy.replace(/^\/api\/files\//, "");
      if (!relative.startsWith(`${kind}/`)) {
        skipped++;
        console.warn(`[${kind}] ${row.id}: ruta legacy inesperada: ${legacy}`);
        continue;
      }
      const localPath = path.join(UPLOADS_DIR, relative);
      try {
        const { ok, url, reason } = await upload(`uploads/${relative}`, localPath, mimeFor(localPath));
        if (!ok) {
          skipped++;
          console.warn(`[${kind}] ${row.id}: ${reason}`);
          continue;
        }
        await sql`UPDATE ${sql(table)} SET pdf_url = ${url} WHERE id = ${row.id}`;
        uploaded++;
        console.log(`[${kind}] ${row.id} -> ${url}`);
      } catch (error) {
        errors.push(`[${kind}] ${row.id}: ${error.message}`);
      }
    }
  }

  await sql.end();

  console.log("\n--- Resumen ---");
  console.log(`Subidos: ${uploaded}`);
  console.log(`Omitidos: ${skipped}`);
  if (errors.length) {
    console.log(`Errores (${errors.length}):`);
    for (const e of errors) console.log("  " + e);
  }
  const heaps = (process.memoryUsage().heapUsed - usageStart) / 1024 / 1024;
  console.log(`Heap delta: ${heaps.toFixed(1)} MB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});