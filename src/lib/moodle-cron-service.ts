import { db } from "@/db";
import { moodleCredentials } from "@/db/schema";
import { syncMoodleCredentialRow } from "@/features/moodle/lib/sync";

export type MoodleCronSummary = {
  processed: number;
  errors: string[];
};

/**
 * Jitter entre credenciales para no golpear el login de Moodle en ráfaga:
 * el cliente es un scrape no oficial (sin retry/backoff propio), así que
 * espaciar los logins reduce el riesgo de que UTP lo detecte o limite.
 */
function randomJitterMs(): number {
  return 2000 + Math.floor(Math.random() * 3000); // 2-5s
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Barrido diario para todos los usuarios: recorre cada fila de
 * `moodle_credentials` (no solo las de un usuario) y sincroniza una por una,
 * sin dejar que el fallo de una credencial bloquee a las demás.
 */
export async function syncAllMoodleCredentialsForCron(): Promise<MoodleCronSummary> {
  const rows = await db.select().from(moodleCredentials);
  const errors: string[] = [];
  let processed = 0;

  for (let i = 0; i < rows.length; i++) {
    const credRow = rows[i]!;
    try {
      await syncMoodleCredentialRow(credRow);
      processed++;
    } catch (error) {
      errors.push(
        `Credencial ${credRow.id} (${credRow.platform}, user ${credRow.userId}): ${
          error instanceof Error ? error.message : "error desconocido"
        }`
      );
    }

    if (i < rows.length - 1) {
      await sleep(randomJitterMs());
    }
  }

  return { processed, errors };
}
