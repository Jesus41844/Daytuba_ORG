/**
 * Exporta todas las colecciones de Firestore a scripts/migration-data.json
 *
 * Uso: npx tsx --env-file=.env.local scripts/export-firestore.ts
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { writeFileSync } from "node:fs";

const COLLECTIONS = [
  "users",
  "projects",
  "categories",
  "tasks",
  "calendar_events",
  "schedule_blocks",
  "moodle_credentials",
] as const;

function getAdmin(): { db: ReturnType<typeof getFirestore>; auth: ReturnType<typeof getAuth> } {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY en .env.local"
    );
  }

  const existing = getApps().find((app) => app.name === "export-script");
  const app =
    existing ??
    initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }) },
      "export-script"
    );

  return { db: getFirestore(app), auth: getAuth(app) };
}

function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && "toMillis" in (value as object)) {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as object).map(([k, v]) => [k, serialize(v)])
    );
  }
  return value;
}

async function main() {
  const { db, auth } = getAdmin();
  const output: Record<string, Record<string, unknown>[]> = {};

  // Usuarios desde Firebase Auth (fuente de verdad para uid → email)
  const authUsers: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  do {
    const list = await auth.listUsers(1000, pageToken);
    for (const user of list.users) {
      authUsers.push({
        __id: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        photoUrl: user.photoURL ?? null,
      });
    }
    pageToken = list.pageToken;
  } while (pageToken);
  output.__auth_users = authUsers;
  console.log(`__auth_users: ${authUsers.length} usuarios`);

  for (const name of COLLECTIONS) {
    const snapshot = await db.collection(name).get();
    output[name] = snapshot.docs.map((doc) => ({
      __id: doc.id,
      ...Object.fromEntries(
        Object.entries(doc.data()).map(([k, v]) => [k, serialize(v)])
      ),
    }));
    console.log(`${name}: ${output[name].length} documentos`);
  }

  writeFileSync("scripts/migration-data.json", JSON.stringify(output));
  console.log("\nEscrito en scripts/migration-data.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
