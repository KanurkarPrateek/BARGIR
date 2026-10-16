"use server";

import { normalizeHex } from "@/lib/brand";
import { requireOwner } from "@/lib/tenant";
import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
// Sign-in for the people who run a gym, and for the platform admin who
// creates gyms.
import base from "@/lib/prisma";
import { PHONE_ERROR, normalizeIndianMobile } from "@/lib/phone";
import {
  Role,
  clearSession,
  getSession,
  hashPassword,
  passwordVersion,
  setSession,
  verifyPassword,
} from "@/lib/session";
import { gymBrand } from "@/lib/gym-brand";
import { checkLoginAllowed, clearLoginFailures, recordLoginFailure } from "@/lib/login-limit";
import { timingSafeEqual } from "crypto";

// Checked against when the phone number has no login, to take the same time.
const DUMMY_HASH = hashPassword("not-a-real-password");

export interface SessionInfo {
  name: string;
  role: Role;
  gymId: string | null;
  gymName: string | null;
  gymLogo: string | null;
  gymBrandColor: string | null;
}

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Returns where to go next. The same message is used for every failure so it
// does not reveal which phone numbers have accounts.
export async function SignIn(login: string, password: string): Promise<string | Failed> {
  return safe(async () => {
    const failed = new UserError("Wrong phone number or password");
    login = login.trim();

    const phone = normalizeIndianMobile(login);
    const limitKey = phone ?? login;
    await checkLoginAllowed(limitKey);
    const wrong = async () => {
      await recordLoginFailure(limitKey);
      return failed;
    };

    const adminLogin = process.env.SUPERADMIN_LOGIN;
    const adminPassword = process.env.SUPERADMIN_PASSWORD;
    if (adminLogin && adminPassword && sameText(login, adminLogin)) {
      if (!sameText(password, adminPassword)) throw await wrong();
      await clearLoginFailures(limitKey);
      await setSession({ userId: "superadmin", name: "Platform admin", role: "superadmin", gymId: null });
      return "/admin/gyms";
    }

    if (!phone) throw await wrong();
    const user = await base.user.findUnique({
      where: { phone: BigInt(phone) },
      include: { gym: true },
    });
    // Unknown numbers take as long as known ones, so timing does not tell
    // which numbers have a login.
    const valid = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw await wrong();
    if (!user.gym.active) throw new UserError("This gym's account is switched off. Contact support.");

    await clearLoginFailures(limitKey);
    await setSession({ userId: user.id, name: user.name, role: user.role, gymId: user.gym_id, pv: passwordVersion(user.passwordHash) });
    return "/dashboard";
  });
}

export async function SignOut(): Promise<void> {
  await clearSession();
}

export async function GetSessionInfo(): Promise<SessionInfo | null> {
  const session = await getSession();
  if (!session) return null;
  const gym = session.gymId
    ? await gymBrand(session.gymId)
    : null;
  return {
    name: session.name,
    role: session.role,
    gymId: session.gymId,
    gymName: gym?.name ?? null,
    gymLogo: gym?.logoUrl ?? null,
    gymBrandColor: gym?.brandColor ?? null,
  };
}

export async function ChangeMyPassword(current: string, next: string): Promise<void | Failed> {
  return safe(async () => {
    const session = await getSession();
    if (!session || session.role === "superadmin") {
      throw new UserError("The platform admin password is set in the server settings");
    }
    if (next.length < 8) throw new UserError("Use at least 8 characters");
    const user = await base.user.findUnique({ where: { id: session.userId } });
    if (!user || !verifyPassword(current, user.passwordHash)) {
      throw new UserError("Current password is wrong");
    }
    const passwordHash = hashPassword(next);
    await base.user.update({ where: { id: user.id }, data: { passwordHash } });
    // Other devices are signed out; this one stays signed in.
    await setSession({ userId: user.id, name: user.name, role: user.role, gymId: user.gym_id, pv: passwordVersion(passwordHash) });
  });
}

export interface GymProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  invoiceTerms: string;
  // Data URL of the logo, or "" for none.
  logo: string;
  // "#rrggbb", or "" for the default.
  brandColor: string;
}

// The browser shrinks the logo before sending; this is a backstop.
const MAX_LOGO_CHARS = 300_000;

// The gym's own details: used in WhatsApp messages and printed on invoices.
export async function GetGymProfile(): Promise<GymProfile | null> {
  const session = await getSession();
  if (!session?.gymId) return null;
  const gym = await base.gym.findUnique({ where: { id: session.gymId } });
  if (!gym) return null;
  return {
    name: gym.name,
    address: gym.address ?? "",
    phone: gym.phone?.toString() ?? "",
    email: gym.email ?? "",
    gstin: gym.gstin ?? "",
    invoiceTerms: gym.invoiceTerms ?? "",
    logo: gym.logo ?? "",
    brandColor: gym.brandColor ?? "",
  };
}

export async function UpdateGymProfile(data: GymProfile): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    const session = await getSession();
    if (!session?.gymId) throw new UserError("Please sign in");
    if (!data.name.trim()) throw new UserError("Enter the gym's name");
    const phone = data.phone.trim() ? normalizeIndianMobile(data.phone) : null;
    if (data.phone.trim() && !phone) throw new UserError(PHONE_ERROR);
    if (data.logo && !/^data:image\/(png|jpeg|webp);base64,/.test(data.logo)) {
      throw new UserError("The logo must be a PNG, JPG or WebP image");
    }
    if (data.logo.length > MAX_LOGO_CHARS) throw new UserError("The logo image is too large");
    const brandColor = data.brandColor ? normalizeHex(data.brandColor) : null;
    if (data.brandColor && !brandColor) throw new UserError("Brand colour must look like #1f6feb");
    await base.gym.update({
      where: { id: session.gymId },
      data: {
        brandColor,
        name: data.name.trim(),
        address: data.address.trim() || null,
        phone: phone ? BigInt(phone) : null,
        email: data.email.trim() || null,
        gstin: data.gstin.trim().toUpperCase() || null,
        invoiceTerms: data.invoiceTerms.trim() || null,
        logo: data.logo || null,
      },
    });
  });
}
