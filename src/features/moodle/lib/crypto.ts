import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX = process.env.MOODLE_ENCRYPTION_KEY;

function getKey(): Buffer {
  if (!KEY_HEX) {
    throw new Error("MOODLE_ENCRYPTION_KEY no está configurada en .env.local");
  }
  return Buffer.from(KEY_HEX, "hex");
}

export function encrypt(plaintext: string): { ciphertext: string; iv: string; tag: string } {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return {
    ciphertext: encrypted,
    iv: iv.toString("hex"),
    tag,
  };
}

export function decrypt(ciphertext: string, ivHex: string, tagHex: string): string {
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
