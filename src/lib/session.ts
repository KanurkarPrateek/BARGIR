// Signed-cookie sessions for gym staff and the platform admin.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import base from "@/lib/prisma";

export type Role = "superadmin" | "owner" | "staff";

export interface Session {
  userId: string;
  name: string;
  role: Role;
  // The gym being worked in. Null only for the platform admin before they
  // open a gym.
  gymId: string | null;
  // Changes when the login's password changes, which signs out its other
  // sessions (see passwordVersion).
  pv?: string;
  exp: number;
}

// A short fingerprint of the stored password (its salt, new on every change).
export const passwordVersion = (passwordHash: string) => passwordHash.slice(0, 12);

const COOKIE = "gym_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return value;
}

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

function decode(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

// The cookie alone lasts 14 days, so it is checked against the database too:
// a removed login, a changed password or a switched-off gym ends the session
// within a minute. Results are kept briefly to avoid a query on every call.
const CHECK_EVERY_MS = 60 * 1000;
const checked = new Map<string, { ok: boolean; until: number }>();

async function stillValid(session: Session): Promise<boolean> {
  const key = `${session.userId}:${session.gymId}:${session.role}:${session.pv ?? ""}`;
  const hit = checked.get(key);
  if (hit && hit.until > Date.now()) return hit.ok;
  let ok: boolean;
  if (session.role === "superadmin") {
    // The platform admin can open any gym that still exists.
    ok = !session.gymId || !!(await base.gym.findUnique({ where: { id: session.gymId }, select: { id: true } }));
  } else {
    const user = await base.user.findUnique({
      where: { id: session.userId },
      select: { gym_id: true, role: true, passwordHash: true, gym: { select: { active: true } } },
    });
    ok =
      !!user &&
      user.gym_id === session.gymId &&
      user.role === session.role &&
      user.gym.active &&
      (!session.pv || session.pv === passwordVersion(user.passwordHash));
  }
  if (checked.size > 5000) checked.clear();
  checked.set(key, { ok, until: Date.now() + CHECK_EVERY_MS });
  return ok;
}

// Null when nobody is signed in, and also outside a request (scheduler, scripts).
export async function getSession(): Promise<Session | null> {
  try {
    const session = decode((await cookies()).get(COOKIE)?.value);
    return session && (await stillValid(session)) ? session : null;
  } catch {
    return null;
  }
}

export async function setSession(session: Omit<Session, "exp">): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({ ...session, exp: Date.now() + MAX_AGE_SECONDS * 1000 })
  ).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const given = scryptSync(password, salt, 64);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
