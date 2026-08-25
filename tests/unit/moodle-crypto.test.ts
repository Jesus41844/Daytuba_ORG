import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/features/moodle/lib/crypto";

describe("moodle crypto (AES-256-GCM)", () => {
  it("cifra y descifra roundtrip", () => {
    const secret = "MiPasswordMoodle#2026";
    const { ciphertext, iv, tag } = encrypt(secret);
    expect(ciphertext).not.toBe(secret);
    expect(decrypt(ciphertext, iv, tag)).toBe(secret);
  });

  it("produce IV distintos para el mismo plaintext", () => {
    const a = encrypt("mismo-texto");
    const b = encrypt("mismo-texto");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("falla si el tag fue manipulado", () => {
    const { ciphertext, iv, tag } = encrypt("secreto");
    const tampered = (parseInt(tag[0], 16) ^ 1).toString(16) + tag.slice(1);
    expect(() => decrypt(ciphertext, iv, tampered)).toThrow();
  });
});
