"use server";

import type { Query } from "firebase-admin/firestore";
import { getDb } from "@/lib/db/server";
import { mapProject } from "@/lib/firebase/mappers";
import type { Project } from "@/types";
import { requireSession } from "@/lib/auth/session";

export async function getUserProjects(): Promise<Project[]> {
  const session = await requireSession();
  const db = await getDb();

  try {
    let q: Query = db
      .collection("projects")
      .where("userId", "==", session.uid);

    q = q.orderBy("sortOrder", "asc").orderBy("createdAt", "asc");

    const snapshot = await q.get();
    return snapshot.docs.map(mapProject);
  } catch (error) {
    console.error("getUserProjects query failed, trying fallback:", error);
    const snapshot = await db
      .collection("projects")
      .where("userId", "==", session.uid)
      .get();
    return snapshot.docs.map(mapProject);
  }
}

export async function getProjectById(id: string): Promise<Project | null> {
  const session = await requireSession();
  const db = await getDb();

  const snapshot = await db.collection("projects").doc(id).get();
  if (!snapshot.exists) return null;
  if (snapshot.get("userId") !== session.uid) return null;
  return mapProject(snapshot);
}
