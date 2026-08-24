/* eslint-disable @next/next/no-location-assign-relative-destination -- hard navigation is required so the proxy and server components observe the freshly set __session cookie */
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as firebaseUpdateProfile,
  updatePassword as firebaseUpdatePassword,
} from "firebase/auth";

import { auth } from "@/lib/firebase/client";
import type { ActionResult } from "@/lib/errors";

const SESSION_ENDPOINT = "/api/auth/session";

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Credenciales inválidas. Verifica tu email y contraseña.",
  "auth/user-not-found": "No existe una cuenta con este email.",
  "auth/wrong-password": "Contraseña incorrecta.",
  "auth/too-many-requests": "Demasiados intentos. Intenta de nuevo más tarde.",
  "auth/email-already-in-use": "Ya existe una cuenta con este email.",
  "auth/weak-password": "La contraseña es demasiado débil.",
  "auth/popup-closed-by-user": "Ventana de Google cerrada antes de completar el inicio de sesión.",
  "auth/network-request-failed": "Error de red. Verifica tu conexión.",
};

function toActionError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: string }).code;
    return FIREBASE_ERROR_MESSAGES[code] ?? fallback;
  }
  return fallback;
}

async function createRemoteSession(idToken: string): Promise<void> {
  const response = await fetch(SESSION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: idToken }),
  });

  if (!response.ok) {
    throw new Error("No se pudo crear la sesión");
  }
}

async function destroyRemoteSession(): Promise<void> {
  await fetch(SESSION_ENDPOINT, { method: "DELETE" });
}

export async function login(
  email: string,
  password: string
): Promise<ActionResult<void>> {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await user.getIdToken();
    await createRemoteSession(idToken);
    window.location.href = "/dashboard";
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: toActionError(error, "No se pudo iniciar sesión. Intenta de nuevo."),
    };
  }
}

export async function register(
  displayName: string,
  email: string,
  password: string
): Promise<ActionResult<void>> {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await firebaseUpdateProfile(user, { displayName });
    const idToken = await user.getIdToken(true);
    await createRemoteSession(idToken);
    window.location.href = "/dashboard";
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: toActionError(error, "No se pudo crear la cuenta. Intenta de nuevo."),
    };
  }
}

export async function logout(): Promise<void> {
  await signOut(auth);
  await destroyRemoteSession();
  window.location.href = "/login";
}

export async function signInWithGoogle(): Promise<ActionResult<void>> {
  try {
    const provider = new GoogleAuthProvider();
    const { user } = await signInWithPopup(auth, provider);
    const idToken = await user.getIdToken();
    await createRemoteSession(idToken);
    window.location.href = "/dashboard";
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: toActionError(error, "No se pudo iniciar sesión con Google."),
    };
  }
}

export async function updateUserProfile(data: {
  displayName?: string;
  photoUrl?: string;
}): Promise<ActionResult<void>> {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: "No hay sesión activa" };

    await firebaseUpdateProfile(user, {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.photoUrl !== undefined && { photoURL: data.photoUrl || null }),
    });

    const idToken = await user.getIdToken(true);
    await createRemoteSession(idToken);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: toActionError(error, "No se pudo actualizar el perfil."),
    };
  }
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult<void>> {
  try {
    const user = auth.currentUser;
    if (!user || !user.email)
      return { success: false, error: "No hay sesión activa" };

    const credential = EmailAuthProvider.credential(
      user.email,
      data.currentPassword
    );
    await reauthenticateWithCredential(user, credential);
    await firebaseUpdatePassword(user, data.newPassword);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: toActionError(error, "No se pudo cambiar la contraseña."),
    };
  }
}
