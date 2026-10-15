"use server";

// Staff Management: people who work at the gym, their shifts, their
// attendance, and front-desk logins.
import base from "@/lib/prisma";
import prisma, { requireGymId, requireOwner } from "@/lib/tenant";
import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
import { requireIndianMobile } from "@/lib/phone";
import { hashPassword } from "@/lib/session";
import { parseDate, todayString } from "@/lib/membership";
import { format, isValid } from "date-fns";

export interface StaffInput {
  id?: string;
  name: string;
  phone: string;
  role: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  salary?: number | null;
  joinDate: string;
  active: boolean;
}

export interface StaffRow extends StaffInput {
  id: string;
  biometricId: string | null;
  hasLogin: boolean;
  // Today's attendance, if any.
  todayIn: string | null;
  todayOut: string | null;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GetStaffList(): Promise<StaffRow[]> {
  const today = todayString();
  const staff = await prisma.staff.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { attendance: { where: { date: today } } },
  });
  const logins = await base.user.findMany({
    where: { gym_id: await requireGymId(), staff_id: { in: staff.map((s) => s.id) } },
    select: { staff_id: true },
  });
  const withLogin = new Set(logins.map((l) => l.staff_id));
  return staff.map(({ attendance, ...s }) => ({
    id: s.id,
    name: s.name,
    phone: s.phone.toString(),
    role: s.role,
    shiftStart: s.shiftStart,
    shiftEnd: s.shiftEnd,
    salary: s.salary,
    joinDate: s.joinDate,
    active: s.active,
    biometricId: s.biometricId,
    hasLogin: withLogin.has(s.id),
    todayIn: attendance[0]?.inTime ?? null,
    todayOut: attendance[0]?.outTime ?? null,
  }));
}

export async function SaveStaff(data: StaffInput): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    if (!data.name.trim()) throw new UserError("Enter the staff member's name");
    if (!data.role.trim()) throw new UserError("Enter their role, e.g. Front desk");
    if (!isValid(parseDate(data.joinDate))) throw new UserError("Pick the joining date");
    for (const t of [data.shiftStart, data.shiftEnd]) {
      if (t && !TIME.test(t)) throw new UserError("Shift times must look like 07:00");
    }
    const values = {
      name: data.name.trim(),
      phone: requireIndianMobile(data.phone),
      role: data.role.trim(),
      shiftStart: data.shiftStart || null,
      shiftEnd: data.shiftEnd || null,
      salary: data.salary ? Math.trunc(data.salary) : null,
      joinDate: data.joinDate,
      active: data.active,
    };
    if (data.id) {
      await prisma.staff.update({ where: { id: data.id }, data: values });
      // Someone who has left loses their login.
      if (!data.active) await base.user.deleteMany({ where: { staff_id: data.id } });
    } else {
      await prisma.staff.create({ data: values });
    }
  });
}

// Front-desk login for a staff member: they sign in with their own phone
// number and see members, enquiries, attendance and sales, but not money
// reports, expenses, staff or setup.
export async function SetStaffLogin(staff_id: string, password: string): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    if (password.length < 8) throw new UserError("Password needs at least 8 characters");
    const staff = await prisma.staff.findUnique({ where: { id: staff_id } });
    if (!staff) throw new UserError("Staff member not found");
    if (!staff.active) throw new UserError(`${staff.name} is marked as no longer working here`);
    const existing = await base.user.findUnique({ where: { phone: staff.phone } });
    if (existing && existing.staff_id !== staff.id) {
      throw new UserError("That phone number already has a login");
    }
    if (existing) {
      await base.user.update({ where: { id: existing.id }, data: { passwordHash: hashPassword(password) } });
    } else {
      await base.user.create({
        data: {
          gym_id: await requireGymId(),
          name: staff.name,
          phone: staff.phone,
          passwordHash: hashPassword(password),
          role: "staff",
          staff_id: staff.id,
        },
      });
    }
  });
}

export async function RemoveStaffLogin(staff_id: string): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    await base.user.deleteMany({ where: { staff_id, gym_id: await requireGymId() } });
  });
}

// ---------- Staff Attendance ----------

export interface StaffAttendanceRow {
  id: string;
  staff_id: string;
  name: string;
  role: string;
  date: string;
  inTime: string;
  outTime: string | null;
  // Minutes after the shift start; null when there is no shift or on time.
  lateBy: number | null;
}

const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export async function GetStaffAttendance(from: string, to: string): Promise<StaffAttendanceRow[]> {
  const start = parseDate(from), end = parseDate(to);
  const rows = await prisma.staffAttendance.findMany({
    include: { staff: { select: { name: true, role: true, shiftStart: true } } },
  });
  return rows
    .filter((r) => {
      const d = parseDate(r.date);
      return d >= start && d <= end;
    })
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime() || a.inTime.localeCompare(b.inTime))
    .map((r) => {
      const late = r.staff.shiftStart ? mins(r.inTime) - mins(r.staff.shiftStart) : 0;
      return {
        id: r.id,
        staff_id: r.staff_id,
        name: r.staff.name,
        role: r.staff.role,
        date: r.date,
        inTime: r.inTime,
        outTime: r.outTime,
        lateBy: late > 5 ? late : null,
      };
    });
}

// Front desk marks a staff member in, or out if they are already in.
export async function MarkStaffAttendance(staff_id: string): Promise<"in" | "out" | Failed> {
  return safe(async () => {
    const date = todayString();
    const now = format(new Date(), "HH:mm:ss");
    const existing = await prisma.staffAttendance.findFirst({ where: { staff_id, date } });
    if (!existing) {
      await prisma.staffAttendance.create({ data: { staff_id, date, inTime: now } });
      return "in" as const;
    }
    await prisma.staffAttendance.update({ where: { id: existing.id }, data: { outTime: now } });
    return "out" as const;
  });
}
