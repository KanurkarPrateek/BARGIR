// Slows down password guessing: after 8 wrong passwords for one login (or 30
// from one network) within 15 minutes, further attempts are refused for 15
// minutes. Kept in the database so it holds across server instances.
import base from "@/lib/prisma";
import { headers } from "next/headers";
import { UserError } from "@/lib/safe-action";

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  } catch {
    return "unknown";
  }
}

async function keysFor(login: string) {
  return [
    { key: `login:${login.toLowerCase()}`, max: 8 },
    { key: `ip:${await clientIp()}`, max: 30 },
  ];
}

// Throws when this login or network is locked out.
export async function checkLoginAllowed(login: string): Promise<void> {
  const rows = await base.loginAttempt.findMany({
    where: { key: { in: (await keysFor(login)).map((k) => k.key) } },
  });
  const lockedUntil = rows.map((r) => r.lockedUntil?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
  if (lockedUntil > Date.now()) {
    const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
    throw new UserError(`Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
}

export async function recordLoginFailure(login: string): Promise<void> {
  const now = new Date();
  for (const { key, max } of await keysFor(login)) {
    const row = await base.loginAttempt.findUnique({ where: { key } });
    const fresh = !row || now.getTime() - row.windowStart.getTime() > WINDOW_MS;
    const failures = fresh ? 1 : row.failures + 1;
    const data = {
      failures,
      windowStart: fresh ? now : row.windowStart,
      lockedUntil: failures >= max ? new Date(now.getTime() + LOCK_MS) : row?.lockedUntil ?? null,
    };
    await base.loginAttempt.upsert({ where: { key }, create: { key, ...data }, update: data });
  }
}

export async function clearLoginFailures(login: string): Promise<void> {
  await base.loginAttempt.deleteMany({ where: { key: `login:${login.toLowerCase()}` } });
}
