import { getFirestore } from "firebase-admin/firestore";

let adminDb: ReturnType<typeof getFirestore>;

export async function getDb() {
  if (!adminDb) {
    const { firebaseAdmin } = await import("@/lib/firebase/admin");
    adminDb = getFirestore(firebaseAdmin);
  }
  return adminDb;
}
