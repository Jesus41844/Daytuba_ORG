import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

function loadDotEnv(file = ".env") {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env file, rely on process env
  }
}

loadDotEnv(resolve(process.cwd(), ".env"));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "Falta DATABASE_URL. Ejemplo:\n  DATABASE_URL='postgres://usuario:pass@host:puerto/db' node scripts/migrate-remote.mjs"
  );
  process.exit(1);
}

if (validationHelper(connectionString) === false) process.exit(1);

function validationHelper(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") {
      console.error("DATABASE_URL debe empezar con postgres:// o postgresql://");
      return false;
    }
  } catch {
    console.error("DATABASE_URL no es una URL válida:", url);
    return false;
  }
  return true;
}

const client = postgres(connectionString, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 15,
});

const db = drizzle(client, { logger: false });

const [port, host] = (() => {
  try {
    const u = new URL(connectionString);
    return [u.port || "5432", u.hostname];
  } catch {
    return ["?", "?"];
  }
})();

console.log(`Conectando a ${host}:${port} …`);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migraciones aplicadas correctamente ✓");
} catch (err) {
  console.error("Error al aplicar migraciones:", err.message);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 }).catch(() => {});
}