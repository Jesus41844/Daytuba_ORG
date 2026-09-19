import { cookies } from "next/headers";

import { getSession } from "@/lib/auth/session";
import { getWorkspaceRole } from "@/lib/access";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace";

/**
 * Obtiene el ID del espacio de trabajo actualmente seleccionado (desde la
 * cookie del navegador). Valida que el usuario siga siendo miembro; si no,
 * devuelve null (fallback a Personal). Devuelve null si no hay sesión o la
 * cookie no está seteada.
 */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (!raw) return null;

  // Defense-in-depth: valida que el usuario aún pertenezca al workspace.
  // Si no (fue removido, o el workspace se eliminó), fallback a Personal.
  const role = await getWorkspaceRole(raw, session.uid);
  return role ? raw : null;
}

/**
 * Helper para escribir la cookie del workspace activo en Server Actions.
 * No llamar directamente; usá setActiveWorkspace en workspaces/actions.ts.
 */
export async function setActiveWorkspaceCookie(
  workspaceId: string | null
): Promise<void> {
  const cookieStore = await cookies();

  if (workspaceId === null) {
    // Limpiar: Personal
    cookieStore.set({
      name: ACTIVE_WORKSPACE_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
  } else {
    // Setear el workspace activo (persistente por 1 año)
    cookieStore.set({
      name: ACTIVE_WORKSPACE_COOKIE,
      value: workspaceId,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 año
    });
  }
}
