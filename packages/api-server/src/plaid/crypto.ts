import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Plaid access tokens are long-lived credentials, so they are encrypted at
 * rest with AES-256-GCM. The key is PLAID_TOKEN_KEY: 32 random bytes, base64.
 * Generate one with: openssl rand -base64 32
 */
export function parseTokenKey(value: string): Buffer {
  const key = Buffer.from(value.trim(), "base64");
  if (key.length !== 32) throw new Error("PLAID_TOKEN_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)");
  return key;
}

export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptToken(stored: string, key: Buffer): string {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognized encrypted token format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
