import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está configurada");
}

const globalForDb = globalThis as unknown as {
  client?: postgres.Sql;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

function createClient() {
  return postgres(connectionString!, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export function getDb() {
  if (!globalForDb.client) {
    globalForDb.client = createClient();
    globalForDb.db = drizzle(globalForDb.client, { schema });
  }
  return { client: globalForDb.client, db: globalForDb.db! };
}

export const db = getDb().db;

export { schema };
