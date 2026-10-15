// Passwords, signed login cookies and encrypted cluster API keys, all keyed
// on CONTROL_SECRET.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

function secret(): string {
  const value = process.env.CONTROL_SECRET;
  if (!value || value.length < 32) throw new Error("CONTROL_SECRET must be set to at least 32 characters");
  return value;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const given = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

const key = () => createHash("sha256").update(`cluster-keys:${secret()}`).digest();

// AES-256-GCM; stored as iv.tag.ciphertext (base64url).
export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(stored: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Readable password for a new gym owner: no look-alike characters.
export function newPassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(length), (b) => chars[b % chars.length]).join("");
}
