import { NextResponse, type NextRequest } from "next/server";

import { getSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const SESSION_DURATION_MS = 60 * 60 * 24 * 7 * 1000;

export async function POST(request: NextRequest) {
  let token: unknown;

  try {
    const body = await request.json();
    token = (body as { token?: unknown } | null)?.token;
  } catch {
    token = undefined;
  }

  if (typeof token !== "string" || token.length === 0) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  try {
    const { adminAuth } = await import("@/lib/firebase/admin");
    const decoded = await adminAuth.verifyIdToken(token);
    const sessionCookie = await adminAuth.createSessionCookie(token, {
      expiresIn: SESSION_DURATION_MS,
    });

    const { getFirestore } = await import("firebase-admin/firestore");
    const { firebaseAdmin } = await import("@/lib/firebase/admin");
    const db = getFirestore(firebaseAdmin);
    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set({
        uid: decoded.uid,
        email: decoded.email ?? "",
        displayName: decoded.name ?? "",
        photoUrl: decoded.picture ?? null,
        role: "user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Token inválido o expirado" },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session });
}
