import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { env } from "../config/env.js";

const emailKey = Buffer.from(env.emailEncryptionKey, "hex");
if (emailKey.length !== 32) {
  throw new Error("EMAIL_ENCRYPTION_KEY must be 64 hex chars (32 bytes).");
}

const deterministicIv = createHash("sha256").update(emailKey).digest().subarray(0, 16);

export function hashSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function deterministicEncryptEmail(email: string): string {
  const normalizedEmail = normalizeEmail(email);
  const cipher = createCipheriv("aes-256-cbc", emailKey, deterministicIv);
  const encrypted = Buffer.concat([
    cipher.update(normalizedEmail, "utf8"),
    cipher.final(),
  ]);
  return encrypted.toString("base64url");
}

export function deterministicDecryptEmail(encryptedEmail: string): string {
  const decipher = createDecipheriv("aes-256-cbc", emailKey, deterministicIv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedEmail, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
