import { cookies } from "next/headers";

import { UnauthorizedError } from "@/lib/errors";

export const SESSION_COOKIE_NAME = "__session";

export type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
};

async function getAdminAuth() {
  const { adminAuth } = await import("@/lib/firebase/admin");
  return adminAuth;
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const adminAuth = await getAdminAuth();
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );

    return {
      uid: decodedToken.uid,
      email: decodedToken.email ?? "",
      displayName: decodedToken.name ?? "",
      photoUrl: decodedToken.picture ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}
