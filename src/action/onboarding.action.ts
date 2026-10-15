"use server";

// Getting a new gym running with as little typing as possible: self sign-up,
// the setup wizard's one-click starters, and importing an existing member
// register from Excel.
import base from "@/lib/prisma";
import prisma, { requireGymId, requireOwner } from "@/lib/tenant";
import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
import { normalizeIndianMobile, requireIndianMobile } from "@/lib/phone";
import { getSession, hashPassword, setSession } from "@/lib/session";
import { createDefaultWorkflows } from "@/lib/whatsapp/defaults";
import { DATE_FORMAT } from "@/lib/membership";
import { addMonths, format, isValid, parse } from "date-fns";

// ---------- sign-up ----------

export async function SignUpGym(data: { gymName: string; ownerName: string; phone: string; password: string }): Promise<string | Failed> {
  return safe(async () => {
    // Self sign-up can be switched off when gyms should only be added by the platform admin.
    if (process.env.ALLOW_SIGNUP === "false") throw new UserError("New gyms are added by the platform admin. Please contact support.");
    if (!data.gymName.trim()) throw new UserError("Enter your gym's name");
    if (!data.ownerName.trim()) throw new UserError("Enter your name");
    if (data.password.length < 8) throw new UserError("Password needs at least 8 characters");
    const phone = requireIndianMobile(data.phone);
    if (await base.user.findUnique({ where: { phone } })) {
      throw new UserError("This phone number already has an account. Sign in instead.");
    }
    const gym = await base.gym.create({
      data: {
        name: data.gymName.trim(),
        phone,
        users: { create: { name: data.ownerName.trim(), phone, passwordHash: hashPassword(data.password), role: "owner" } },
      },
      include: { users: true },
    });
    await createDefaultWorkflows(gym.id);
    await setSession({ userId: gym.users[0].id, name: gym.users[0].name, role: "owner", gymId: gym.id });
    return "/setup";
  });
}

export async function IsSignUpOpen(): Promise<boolean> {
  return process.env.ALLOW_SIGNUP !== "false";
}

// ---------- setup wizard ----------

export interface SetupState {
  gymName: string;
  setupDone: boolean;
  packages: number;
  batches: number;
  members: number;
  machines: number;
}

export async function GetSetupState(): Promise<SetupState | null> {
  const session = await getSession();
  if (!session?.gymId) return null;
  const gym = await base.gym.findUnique({ where: { id: session.gymId } });
  if (!gym) return null;
  const [packages, batches, members, machines] = await Promise.all([
    prisma.services.count(),
    prisma.batch.count(),
    prisma.member.count(),
    base.biometricDevice.count({ where: { gym_id: gym.id } }),
  ]);
  return { gymName: gym.name, setupDone: gym.setupDone, packages, batches, members, machines };
}

export interface StarterPackage {
  name: string;
  price: number;
  duration: number;
  isPersonalTraining: boolean;
}

export async function AddStarterPackages(list: StarterPackage[]): Promise<number | Failed> {
  return safe(async () => {
    await requireOwner();
    const existing = new Set((await prisma.services.findMany({ select: { name: true } })).map((s) => s.name.toLowerCase()));
    const fresh = list.filter((p) => p.name.trim() && p.price > 0 && p.duration > 0 && !existing.has(p.name.trim().toLowerCase()));
    if (fresh.length) {
      await prisma.services.createMany({
        data: fresh.map((p) => ({ name: p.name.trim(), price: Math.trunc(p.price), duration: Math.trunc(p.duration), isPersonalTraining: p.isPersonalTraining })),
      });
    }
    return fresh.length;
  });
}

export async function AddStarterBatches(list: { name: string; startTime: string; endTime: string }[]): Promise<number | Failed> {
  return safe(async () => {
    await requireOwner();
    const existing = new Set((await prisma.batch.findMany({ select: { name: true } })).map((b) => b.name.toLowerCase()));
    const fresh = list.filter((b) => b.name.trim() && !existing.has(b.name.trim().toLowerCase()) && b.endTime > b.startTime);
    if (fresh.length) await prisma.batch.createMany({ data: fresh.map((b) => ({ name: b.name.trim(), startTime: b.startTime, endTime: b.endTime })) });
    return fresh.length;
  });
}

export async function FinishSetup(): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    await base.gym.update({ where: { id: await requireGymId() }, data: { setupDone: true } });
  });
}

// ---------- importing members ----------

// One row of the member register, as read from the gym's Excel or CSV file.
// Dates may be dd-MM-yyyy, dd/MM/yyyy or yyyy-MM-dd.
export interface ImportRow {
  name: string;
  phone: string;
  gender?: string;
  dob?: string;
  joinDate?: string;
  package?: string;
  startDate?: string;
  paid?: number | string;
  email?: string;
  machineId?: string;
}

export interface ImportResult {
  created: number;
  withSubscription: number;
  problems: { row: number; name: string; reason: string }[];
}

const DATE_INPUTS = ["dd-MM-yyyy", "dd/MM/yyyy", "yyyy-MM-dd", "d-M-yyyy", "d/M/yyyy", "dd.MM.yyyy"];

function toDate(value: string | undefined): string | null | undefined {
  const text = value?.toString().trim();
  if (!text) return undefined;
  for (const pattern of DATE_INPUTS) {
    const d = parse(text, pattern, new Date());
    if (isValid(d) && d.getFullYear() > 1900) return format(d, DATE_FORMAT);
  }
  return null; // present but unreadable
}

// Imports rows in order. `firstRow` is the spreadsheet row number of rows[0],
// so problems point at the right line. Running subscriptions come in as
// BackDate records: nobody is messaged and payments keep their dates.
export async function ImportMembers(rows: ImportRow[], firstRow: number): Promise<ImportResult | Failed> {
  return safe(async () => {
    await requireOwner();
    if (rows.length > 200) throw new UserError("Send at most 200 rows at a time");
    const gym_id = await requireGymId();
    const packages = await prisma.services.findMany();
    const byName = new Map(packages.map((p) => [p.name.trim().toLowerCase(), p]));
    const result: ImportResult = { created: 0, withSubscription: 0, problems: [] };

    for (const [index, row] of rows.entries()) {
      const line = firstRow + index;
      const name = row.name?.toString().trim().replace(/\s+/g, " ");
      const problem = (reason: string) => result.problems.push({ row: line, name: name || "(no name)", reason });
      if (!name) { problem("Name is empty"); continue; }
      const phone = normalizeIndianMobile(row.phone?.toString());
      if (!phone) { problem(`"${row.phone ?? ""}" is not a 10-digit Indian mobile number`); continue; }
      const dob = toDate(row.dob), joinDate = toDate(row.joinDate), startDate = toDate(row.startDate);
      if (dob === null || joinDate === null || startDate === null) { problem("A date could not be read; use dd-mm-yyyy"); continue; }
      const pkgName = row.package?.toString().trim();
      const pkg = pkgName ? byName.get(pkgName.toLowerCase()) : undefined;
      if (pkgName && !pkg) { problem(`Package "${pkgName}" does not exist; add it under Package Management first`); continue; }
      const paid = Math.max(0, Math.trunc(Number(row.paid ?? 0)) || 0);
      if (pkg && paid > pkg.price) { problem(`Paid ₹${paid} is more than the package price ₹${pkg.price}`); continue; }
      if (await prisma.member.findFirst({ where: { name: { equals: name, mode: "insensitive" }, phone: BigInt(phone) } })) {
        problem("Already a member (same name and phone); skipped");
        continue;
      }
      const machineId = row.machineId?.toString().trim() || null;
      if (machineId && (await prisma.member.findFirst({ where: { biometricId: machineId } }))) {
        problem(`Machine ID ${machineId} already belongs to another member`);
        continue;
      }
      const gender = (row.gender ?? "").toString().trim().toLowerCase();
      try {
      const member = await prisma.member.create({
        data: {
          name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
          phone: BigInt(phone),
          email: row.email?.toString().trim() || null,
          gender: gender.startsWith("m") ? "male" : gender.startsWith("f") ? "female" : "other",
          DOB: dob ?? "",
          DOJ: joinDate ?? startDate ?? format(new Date(), DATE_FORMAT),
          memberCode: `MEM${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`,
          biometricId: machineId,
        },
      });
      result.created++;
      if (pkg) {
        const start = startDate ?? joinDate ?? format(new Date(), DATE_FORMAT);
        await prisma.sales.create({
          data: {
            member_id: member.id,
            service_id: pkg.id,
            amount: pkg.price,
            discount: 0,
            paid,
            startDate: start,
            endDate: format(addMonths(parse(start, DATE_FORMAT, new Date()), pkg.duration), DATE_FORMAT),
            description: "Imported",
            payments: paid > 0 ? { create: { gym_id, member_id: member.id, amount: paid, mode: "cash", date: start, note: "Imported" } } : undefined,
          },
        });
        result.withSubscription++;
      }
      } catch (error) {
        console.error("Import row failed:", error);
        problem("Could not be saved; check this row and try again");
      }
    }
    return result;
  });
}

// ---------- machines that contacted the server but nobody has claimed ----------

export async function GetUnclaimedMachines(): Promise<{ serial: string; lastSeenAt: Date | null }[]> {
  // Only machines seen in the last 15 minutes: the one this gym just set up.
  return base.biometricDevice.findMany({
    where: { gym_id: "", lastSeenAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    select: { serial: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function ClaimMachine(serial: string): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    const { count } = await base.biometricDevice.updateMany({
      where: { serial, gym_id: "" },
      data: { gym_id: await requireGymId() },
    });
    if (count === 0) throw new UserError("That machine was just claimed by another gym, or no longer exists");
  });
}
