// Sign-in for your team. Admins run everything; salespeople see only the
// gyms they sold and their own commission.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "crypto";
import { db } from "./db";
import { sign } from "./crypto";

const COOKIE = "control_session";
const MAX_AGE = 60 * 60 * 12;

export async function signIn(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES, path: "/", maxAge: MAX_AGE,
  });
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const a = Buffer.from(signature), b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const { userId, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (exp < Date.now()) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  return user?.active ? user : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
