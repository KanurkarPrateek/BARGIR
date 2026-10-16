"use server";
// Every change made in the Control Panel. Problems are reported by sending the
// browser back with ?error=..., successes with ?ok=...
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { GymStatus, Plan, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { encrypt, hashPassword, verifyPassword } from "@/lib/crypto";
import { requireAdmin, signIn, signOut } from "@/lib/auth";
import { addGymLogin, ClusterError, createRemoteGym, gymLogins, removeGymLogin, updateGymLogin, updateRemoteGym } from "@/lib/cluster-api";
import { openSecrets, sealSecrets, SECRET_FIELDS, type ClusterSecrets } from "@/lib/cluster-config";
import { commissionOn, indianMobile, nextRenewal, parseInputDate, PLANS } from "@/lib/business";
import { addDays } from "date-fns";

function back(path: string, message: string, kind: "error" | "ok" = "error"): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`);
}
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => text(f, k) || null;
const whole = (f: FormData, k: string) => {
  const n = Number(text(f, k));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
};
const errorText = (e: unknown) => (e instanceof ClusterError ? e.message : "Something went wrong talking to the cluster");

// ---------------- sign in ----------------

export async function signInAction(form: FormData) {
  const email = text(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  let user = await db.user.findUnique({ where: { email } });
  // The very first sign-in creates the admin from CONTROL_ADMIN_EMAIL/PASSWORD.
  if (!user && (await db.user.count()) === 0) {
    const adminEmail = (process.env.CONTROL_ADMIN_EMAIL ?? "").toLowerCase();
    const adminPassword = process.env.CONTROL_ADMIN_PASSWORD ?? "";
    if (adminPassword.length >= 8 && email === adminEmail && password === adminPassword) {
      user = await db.user.create({ data: { name: "Admin", email, passwordHash: hashPassword(password), role: "admin", commissionPercent: 0 } });
    }
  }
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) back("/signin", "Wrong email or password");
  await signIn(user.id);
  redirect("/");
}

export async function signOutAction() {
  await signOut();
  redirect("/signin");
}

// ---------------- clusters ----------------

function readSecrets(form: FormData, previous: ClusterSecrets | null): ClusterSecrets {
  const out = {} as ClusterSecrets;
  for (const { key } of SECRET_FIELDS) out[key] = text(form, key) || previous?.[key] || "";
  return out;
}

function readCluster(form: FormData) {
  const appUrl = text(form, "appUrl").replace(/\/$/, "");
  const capacity = whole(form, "capacity");
  return {
    name: text(form, "name"),
    appUrl,
    capacity,
    vercelAccount: optional(form, "vercelAccount"),
    supabaseAccount: optional(form, "supabaseAccount"),
    supabaseProject: optional(form, "supabaseProject"),
    renderAccount: optional(form, "renderAccount"),
    senderUrl: optional(form, "senderUrl")?.replace(/\/$/, "") ?? null,
    notes: optional(form, "notes"),
  };
}

function checkCluster(c: ReturnType<typeof readCluster>, path: string) {
  if (!c.name) back(path, "Give the cluster a name");
  if (!/^https?:\/\/[^\s/]+/.test(c.appUrl)) back(path, "App address must start with https://");
  if (!(c.capacity >= 1 && c.capacity <= 100)) back(path, "Capacity must be between 1 and 100 gyms");
}

export async function addCluster(form: FormData) {
  await requireAdmin();
  const data = readCluster(form);
  checkCluster(data, "/clusters/new");
  const platformKey = text(form, "platformKey");
  if (platformKey.length < 24) back("/clusters/new", "PLATFORM_API_KEY must be at least 24 characters");
  if (await db.cluster.findUnique({ where: { name: data.name } })) back("/clusters/new", "A cluster with that name exists");
  const cluster = await db.cluster.create({
    data: { ...data, apiKeyEncrypted: encrypt(platformKey), secretsEncrypted: sealSecrets(readSecrets(form, null)) },
  });
  redirect(`/clusters/${cluster.id}?ok=${encodeURIComponent("Cluster saved. Paste its settings into Vercel and Render, then check its health here.")}`);
}

export async function updateCluster(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  const path = `/clusters/${id}`;
  const existing = await db.cluster.findUnique({ where: { id } });
  if (!existing) back("/clusters", "Cluster not found");
  const data = readCluster(form);
  checkCluster(data, path);
  if (data.capacity < (await db.gymAccount.count({ where: { cluster_id: id } }))) back(path, "Capacity is lower than the gyms already on it");
  const clash = await db.cluster.findUnique({ where: { name: data.name } });
  if (clash && clash.id !== id) back(path, "A cluster with that name exists");
  const platformKey = text(form, "platformKey");
  if (platformKey && platformKey.length < 24) back(path, "PLATFORM_API_KEY must be at least 24 characters");
  await db.cluster.update({
    where: { id },
    data: {
      ...data,
      ...(platformKey ? { apiKeyEncrypted: encrypt(platformKey) } : {}),
      secretsEncrypted: sealSecrets(readSecrets(form, openSecrets(existing.secretsEncrypted))),
    },
  });
  back(path, "Saved", "ok");
}

export async function deleteCluster(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  if (await db.gymAccount.count({ where: { cluster_id: id } })) back(`/clusters/${id}`, "Move or remove its gyms first");
  await db.cluster.delete({ where: { id } });
  back("/clusters", "Cluster removed from the Control Panel (the deployment itself is untouched)", "ok");
}

// ---------------- gyms ----------------

export async function createGym(form: FormData) {
  await requireAdmin();
  const remoteId = optional(form, "remoteId");
  const retry = `/gyms/new?${new URLSearchParams(Object.fromEntries([...form.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$") && k !== "password") as [string, string][]))}`;
  const name = text(form, "name");
  const ownerName = text(form, "ownerName");
  const ownerPhone = indianMobile(form.get("ownerPhone"));
  const password = String(form.get("password") ?? "");
  const plan = text(form, "plan") as Plan;
  const price = whole(form, "price");
  const startDate = parseInputDate(form.get("startDate"));
  const trial = text(form, "status") === "trial";
  const trialDays = whole(form, "trialDays") || 14;
  const salespersonId = optional(form, "salesperson_id");

  if (!name || !ownerName) back(retry, "Gym name and owner name are needed");
  if (!ownerPhone) back(retry, "Owner phone must be a 10-digit Indian mobile number");
  if (!remoteId && password.length < 8) back(retry, "Owner password needs at least 8 characters");
  if (!PLANS.some((p) => p.value === plan)) back(retry, "Pick a plan");
  if (!(price >= 0)) back(retry, "Enter the price");
  if (!startDate) back(retry, "Enter the start date");

  const cluster = await db.cluster.findUnique({ where: { id: text(form, "cluster_id") }, include: { _count: { select: { gyms: true } } } });
  if (!cluster) back(retry, "Pick a cluster");
  if (cluster._count.gyms >= cluster.capacity) back(retry, `${cluster.name} is full (${cluster.capacity} gyms)`);
  const salesperson = salespersonId ? await db.user.findUnique({ where: { id: salespersonId } }) : null;
  const commissionText = text(form, "commissionPercent");
  const commissionPercent = commissionText === "" ? salesperson?.commissionPercent ?? 0 : whole(form, "commissionPercent");
  if (!(commissionPercent >= 0 && commissionPercent <= 100)) back(retry, "Commission must be 0–100%");

  let id = remoteId;
  if (remoteId) {
    if (await db.gymAccount.findUnique({ where: { cluster_id_remoteId: { cluster_id: cluster.id, remoteId } } })) back(retry, "That gym is already linked");
  } else {
    try {
      id = (await createRemoteGym(cluster, { name, ownerName, ownerPhone, password })).id;
    } catch (e) {
      back(retry, errorText(e));
    }
  }
  const gym = await db.gymAccount.create({
    data: {
      name, ownerName, ownerPhone, city: optional(form, "city"), notes: optional(form, "notes"),
      cluster_id: cluster.id, remoteId: id,
      salesperson_id: salesperson?.id ?? null, commissionPercent,
      plan, price, startDate,
      renewalDate: trial ? addDays(startDate, trialDays) : nextRenewal(startDate, plan),
      status: trial ? "trial" : "active",
    },
  });
  if (!remoteId) {
    // Shown once on the gym page so the login can be copied; gone after 10 minutes.
    (await cookies()).set(`new_login_${gym.id}`, password, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: `/gyms/${gym.id}`, maxAge: 600 });
  }
  back(`/gyms/${gym.id}`, remoteId ? "Gym linked" : `Gym created on ${cluster.name}.`, "ok");
}

export async function updateGym(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  const path = `/gyms/${id}`;
  const plan = text(form, "plan") as Plan;
  const price = whole(form, "price");
  const commissionPercent = whole(form, "commissionPercent");
  const renewalDate = parseInputDate(form.get("renewalDate"));
  const ownerPhone = indianMobile(form.get("ownerPhone"));
  if (!text(form, "name") || !text(form, "ownerName")) back(path, "Gym name and owner name are needed");
  if (!ownerPhone) back(path, "Owner phone must be a 10-digit Indian mobile number");
  if (!PLANS.some((p) => p.value === plan) || !(price >= 0) || !renewalDate) back(path, "Check plan, price and renewal date");
  if (!(commissionPercent >= 0 && commissionPercent <= 100)) back(path, "Commission must be 0–100%");
  await db.gymAccount.update({
    where: { id },
    data: {
      name: text(form, "name"), ownerName: text(form, "ownerName"), ownerPhone, city: optional(form, "city"), notes: optional(form, "notes"),
      salesperson_id: optional(form, "salesperson_id"), commissionPercent, plan, price, renewalDate,
    },
  });
  back(path, "Saved", "ok");
}

export async function setGymStatus(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  const status = text(form, "status") as GymStatus;
  const gym = await db.gymAccount.findUnique({ where: { id }, include: { cluster: true } });
  if (!gym) back("/gyms", "Gym not found");
  if (!["trial", "active", "suspended", "cancelled"].includes(status)) back(`/gyms/${id}`, "Unknown status");
  if (gym.remoteId) {
    try {
      await updateRemoteGym(gym.cluster, gym.remoteId, { active: status === "active" || status === "trial" });
    } catch (e) {
      back(`/gyms/${id}`, errorText(e));
    }
  }
  await db.gymAccount.update({ where: { id }, data: { status } });
  const said = { active: "Gym is active; staff can sign in", trial: "Gym is on trial", suspended: "Gym suspended; nobody there can sign in until resumed", cancelled: "Gym cancelled and switched off" }[status];
  back(`/gyms/${id}`, said, "ok");
}

export async function resetOwnerPassword(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  const password = String(form.get("password") ?? "");
  const gym = await db.gymAccount.findUnique({ where: { id }, include: { cluster: true } });
  if (!gym?.remoteId) back(`/gyms/${id}`, "This gym is not linked to its cluster");
  if (password.length < 8) back(`/gyms/${id}`, "Password needs at least 8 characters");
  try {
    await updateRemoteGym(gym.cluster, gym.remoteId, { ownerPassword: password });
  } catch (e) {
    back(`/gyms/${id}`, errorText(e));
  }
  back(`/gyms/${id}`, `Owner password changed to ${password}. Send it to the owner.`, "ok");
}

// ---------------- gym logins (owner and reception) ----------------

const ROLE_LABEL = { owner: "Owner", staff: "Reception" } as const;

async function linkedGym(id: string) {
  const gym = await db.gymAccount.findUnique({ where: { id }, include: { cluster: true } });
  if (!gym?.remoteId) back(`/gyms/${id}`, "This gym is not linked to its cluster");
  return gym as typeof gym & { remoteId: string };
}

// Shows the login just made or changed once on the gym page, to copy and send.
async function showLogin(gymId: string, appUrl: string, who: { name: string; phone: string; role: "owner" | "staff" }, password: string) {
  const note = `${who.name} (${ROLE_LABEL[who.role]})\nSign in: ${appUrl}/signin\nMobile: ${who.phone}\nPassword: ${password}`;
  (await cookies()).set(`login_note_${gymId}`, note, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: `/gyms/${gymId}`, maxAge: 600 });
}

export async function addLogin(form: FormData) {
  await requireAdmin();
  const gym = await linkedGym(text(form, "id"));
  const path = `/gyms/${gym.id}`;
  const name = text(form, "name");
  const phone = indianMobile(form.get("phone"));
  const role = text(form, "role") === "owner" ? "owner" : "staff";
  const password = String(form.get("password") ?? "");
  if (!name) back(path, "Enter the person's name");
  if (!phone) back(path, "Mobile must be a 10-digit Indian number");
  if (password.length < 8) back(path, "Password needs at least 8 characters");
  try {
    await addGymLogin(gym.cluster, gym.remoteId, { name, phone, role, password });
  } catch (e) {
    back(path, errorText(e));
  }
  await showLogin(gym.id, gym.cluster.appUrl, { name, phone, role }, password);
  back(path, `${ROLE_LABEL[role]} login added for ${name}`, "ok");
}

export async function updateLogin(form: FormData) {
  await requireAdmin();
  const gym = await linkedGym(text(form, "id"));
  const path = `/gyms/${gym.id}`;
  const userId = text(form, "user_id");
  const name = text(form, "name");
  const phone = indianMobile(form.get("phone"));
  const role = text(form, "role") === "owner" ? "owner" : "staff";
  const password = String(form.get("password") ?? "");
  if (!name) back(path, "Enter the person's name");
  if (!phone) back(path, "Mobile must be a 10-digit Indian number");
  if (password && password.length < 8) back(path, "Password needs at least 8 characters");
  let before;
  try {
    before = (await gymLogins(gym.cluster, gym.remoteId)).find((l) => l.id === userId);
  } catch (e) {
    back(path, errorText(e));
  }
  if (!before) back(path, "That login no longer exists");
  try {
    await updateGymLogin(gym.cluster, gym.remoteId, userId, { name, phone, role, ...(password ? { password } : {}) });
  } catch (e) {
    back(path, errorText(e));
  }
  // The gym's record here follows its owner's mobile.
  if (before.role === "owner" && role === "owner" && before.phone === gym.ownerPhone && phone !== gym.ownerPhone) {
    await db.gymAccount.update({ where: { id: gym.id }, data: { ownerPhone: phone, ownerName: name } });
  }
  if (password) await showLogin(gym.id, gym.cluster.appUrl, { name, phone, role }, password);
  back(path, password ? `Login for ${name} saved with the new password; they are signed out on other devices` : `Login for ${name} saved`, "ok");
}

export async function removeLogin(form: FormData) {
  await requireAdmin();
  const gym = await linkedGym(text(form, "id"));
  const path = `/gyms/${gym.id}`;
  try {
    await removeGymLogin(gym.cluster, gym.remoteId, text(form, "user_id"));
  } catch (e) {
    back(path, errorText(e));
  }
  back(path, "Login removed; that person can no longer sign in", "ok");
}

export async function deleteGymRecord(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  const gym = await db.gymAccount.findUnique({ where: { id } });
  if (gym?.status !== "cancelled") back(`/gyms/${id}`, "Cancel the gym first");
  await db.gymAccount.delete({ where: { id } });
  back("/gyms", "Gym removed from the Control Panel. Its data on the cluster is kept (switched off).", "ok");
}

// ---------------- billing ----------------

export async function recordPayment(form: FormData) {
  await requireAdmin();
  const id = text(form, "gym_id");
  const path = `/gyms/${id}`;
  const amount = whole(form, "amount");
  const date = parseInputDate(form.get("date"));
  if (!(amount > 0)) back(path, "Enter the amount received");
  if (!date) back(path, "Enter the date");
  const gym = await db.gymAccount.findUnique({ where: { id }, include: { cluster: true } });
  if (!gym) back("/gyms", "Gym not found");
  const extend = form.get("extend") === "on";
  await db.payment.create({
    data: {
      gym_id: id, amount, date, mode: text(form, "mode") || "upi", note: optional(form, "note"),
      salesperson_id: gym.salesperson_id,
      commission: gym.salesperson_id ? commissionOn(amount, gym.commissionPercent) : 0,
    },
  });
  if (!extend) back(path, "Payment recorded", "ok");

  const renewalDate = nextRenewal(gym.renewalDate, gym.plan);
  const reopen = gym.status === "suspended" || gym.status === "trial";
  await db.gymAccount.update({ where: { id }, data: { renewalDate, status: gym.status === "cancelled" ? "cancelled" : "active" } });
  if (reopen && gym.remoteId) {
    try {
      await updateRemoteGym(gym.cluster, gym.remoteId, { active: true });
    } catch (e) {
      back(path, `Payment recorded, but switching the gym back on failed: ${errorText(e)}`);
    }
  }
  back(path, `Payment recorded; next renewal moved to ${renewalDate.toLocaleDateString("en-IN")}${gym.status === "suspended" ? " and the gym is switched back on" : ""}`, "ok");
}

export async function deletePayment(form: FormData) {
  await requireAdmin();
  const payment = await db.payment.delete({ where: { id: text(form, "id") } });
  back(`/gyms/${payment.gym_id}`, "Payment deleted. The renewal date was not changed; edit it if needed.", "ok");
}

// ---------------- team ----------------

export async function addUser(form: FormData) {
  await requireAdmin();
  const email = text(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const commissionPercent = whole(form, "commissionPercent");
  const role = (text(form, "role") === "admin" ? "admin" : "sales") as Role;
  if (!text(form, "name")) back("/team", "Enter a name");
  if (!/^\S+@\S+\.\S+$/.test(email)) back("/team", "Enter a valid email");
  if (password.length < 8) back("/team", "Password needs at least 8 characters");
  if (!(commissionPercent >= 0 && commissionPercent <= 100)) back("/team", "Commission must be 0–100%");
  if (await db.user.findUnique({ where: { email } })) back("/team", "That email already has a login");
  await db.user.create({ data: { name: text(form, "name"), email, passwordHash: hashPassword(password), role, commissionPercent } });
  back("/team", `${text(form, "name")} added. They sign in with ${email}.`, "ok");
}

export async function updateUser(form: FormData) {
  const me = await requireAdmin();
  const id = text(form, "id");
  const path = `/team/${id}`;
  const commissionPercent = whole(form, "commissionPercent");
  if (!(commissionPercent >= 0 && commissionPercent <= 100)) back(path, "Commission must be 0–100%");
  const active = form.get("active") === "on";
  const role = (text(form, "role") === "admin" ? "admin" : "sales") as Role;
  if (id === me.id && (!active || role !== "admin")) back(path, "You cannot switch off or demote your own login");
  const password = String(form.get("password") ?? "");
  if (password && password.length < 8) back(path, "Password needs at least 8 characters");
  await db.user.update({
    where: { id },
    data: { name: text(form, "name"), commissionPercent, active, role, ...(password ? { passwordHash: hashPassword(password) } : {}) },
  });
  back(path, "Saved. Commission % applies to gyms sold from now on.", "ok");
}

export async function recordPayout(form: FormData) {
  await requireAdmin();
  const id = text(form, "user_id");
  const amount = whole(form, "amount");
  const date = parseInputDate(form.get("date"));
  if (!(amount > 0) || !date) back(`/team/${id}`, "Enter amount and date");
  await db.payout.create({ data: { user_id: id, amount, date, note: optional(form, "note") } });
  revalidatePath("/");
  back(`/team/${id}`, "Commission payout recorded", "ok");
}

export async function deletePayout(form: FormData) {
  await requireAdmin();
  const payout = await db.payout.delete({ where: { id: text(form, "id") } });
  back(`/team/${payout.user_id}`, "Payout deleted", "ok");
}
