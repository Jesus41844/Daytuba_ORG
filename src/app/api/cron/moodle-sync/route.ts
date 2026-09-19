import { NextResponse } from "next/server";

import { syncAllMoodleCredentialsForCron } from "@/lib/moodle-cron-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const summary = await syncAllMoodleCredentialsForCron();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("Cron de sync de Moodle fallido:", error);
    return NextResponse.json(
      { ok: false, error: "Error al sincronizar Moodle" },
      { status: 500 }
    );
  }
}
