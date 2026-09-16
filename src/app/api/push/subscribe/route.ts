import { NextResponse } from "next/server";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { endpoint?: string; p256dh?: string; auth?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { endpoint, p256dh, auth } = body;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Faltan campos de la suscripción" },
      { status: 400 }
    );
  }

  const now = new Date();
  await db
    .insert(pushSubscriptions)
    .values({
      userId: session.uid,
      endpoint,
      p256dh,
      auth,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh, auth },
    });

  return NextResponse.json({ ok: true });
}