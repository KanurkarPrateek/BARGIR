// Logins of one gym, managed from the Control Panel (control/) through
// /api/platform/gyms/[id]/logins. "owner" can do everything; "staff" is the
// reception (front-desk) login, which needs a Staff row in the gym.
import base from "@/lib/prisma";
import { normalizeIndianMobile } from "@/lib/phone";
import { format } from "date-fns";
import { createHash } from "crypto";

export type LoginRole = "owner" | "staff";

export interface PlatformLogin {
  id: string;
  name: string;
  phone: string;
  role: LoginRole;
  createdAt: string;
  // Changes whenever the password changes (also when the person changes it in
  // the app), so the Control Panel knows whether the password it saved is current.
  passwordStamp: string;
}

export class LoginError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const passwordStamp = (passwordHash: string) => createHash("sha256").update(`stamp:${passwordHash}`).digest("hex").slice(0, 16);

export async function listLogins(gymId: string): Promise<PlatformLogin[]> {
  const users = await base.user.findMany({ where: { gym_id: gymId }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  return users.map((u) => ({ id: u.id, name: u.name, phone: u.phone.toString(), role: u.role as LoginRole, createdAt: u.createdAt.toISOString(), passwordStamp: passwordStamp(u.passwordHash) }));
}

export function readRole(value: unknown): LoginRole {
  if (value === "owner" || value === "staff") return value;
  throw new LoginError("Role must be owner or reception");
}

export function readPhone(value: unknown): bigint {
  const phone = normalizeIndianMobile(String(value ?? ""));
  if (!phone) throw new LoginError("Phone must be a 10-digit Indian mobile number");
  return BigInt(phone);
}

export function readPassword(value: unknown): string {
  const password = String(value ?? "");
  if (password.length < 8) throw new LoginError("Password needs at least 8 characters");
  return password;
}

export async function phoneFree(phone: bigint, exceptUserId?: string): Promise<void> {
  const existing = await base.user.findUnique({ where: { phone } });
  if (existing && existing.id !== exceptUserId) {
    throw new LoginError("That phone number already has a login on this cluster", 409);
  }
}

// The gym's Staff row for a reception login: the one with this phone, or a
// new "Front desk" entry, so the login shows up in Staff Management.
export async function staffFor(gymId: string, name: string, phone: bigint): Promise<string> {
  const existing = await base.staff.findFirst({ where: { gym_id: gymId, phone } });
  if (existing) {
    if (!existing.active) await base.staff.update({ where: { id: existing.id }, data: { active: true } });
    return existing.id;
  }
  const staff = await base.staff.create({
    data: { gym_id: gymId, name, phone, role: "Front desk", joinDate: format(new Date(), "dd-MM-yyyy") },
  });
  return staff.id;
}

// A gym always keeps at least one owner login.
export async function keepsAnOwner(gymId: string, changingUserId: string): Promise<void> {
  const owners = await base.user.count({ where: { gym_id: gymId, role: "owner", id: { not: changingUserId } } });
  if (owners === 0) throw new LoginError("This is the gym's only owner login; add another owner first");
}

export function loginErrorResponse(error: unknown): Response {
  if (error instanceof LoginError) return Response.json({ error: error.message }, { status: error.status });
  console.error("platform logins:", error);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
