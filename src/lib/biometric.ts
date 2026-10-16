import prisma from "@/lib/tenant";
import { Prisma } from "@prisma/client";
import { cleanMachineName, isMachineId } from "@/lib/biometric-commands";

// Sentinel "device" for punches imported from a USB export file.
export const FILE_IMPORT_SERIAL = "file-import";

interface Punch {
  pin: string;
  date: string; // dd-MM-yyyy
  time: string; // HH:mm:ss
}

// Attendance log lines look the same over the network and in the machine's
// USB export (attlog.dat): "<user id> <yyyy-MM-dd> <HH:mm:ss> ...". Only
// numeric machine IDs are accepted, the same as the app hands out.
const PUNCH_LINE = /^\s*(\d{1,9})\s+(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2}:\d{2})/;

export function parsePunches(text: string): Punch[] {
  const punches: Punch[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = PUNCH_LINE.exec(line);
    if (!match) continue;
    const [, pin, year, month, day, time] = match;
    punches.push({ pin, date: `${day}-${month}-${year}`, time });
  }
  return punches;
}

// "USER PIN=12\tName=Rahul\t..." lines from the machine's operation log.
export async function saveDeviceUsers(text: string): Promise<void> {
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("USER ")) continue;
    const pin = /PIN=([^\t]+)/.exec(line)?.[1]?.trim();
    const name = cleanMachineName(/Name=([^\t]*)/.exec(line)?.[1] ?? "").trim();
    if (!isMachineId(pin) || !name) continue;
    const existing = await prisma.biometricUser.findFirst({ where: { pin } });
    if (existing) {
      await prisma.biometricUser.update({ where: { id: existing.id }, data: { name } });
    } else {
      await prisma.biometricUser.create({ data: { pin, name } });
    }
  }
}

// Machine IDs are only ever matched to the member an admin linked them to;
// guessing from member codes could credit a stranger's punches to a member.
async function findMemberId(pin: string): Promise<string | null> {
  const linked = await prisma.member.findFirst({
    where: { biometricId: pin },
    select: { id: true },
  });
  return linked?.id ?? null;
}

// Turns stored punches for these machine IDs into attendance. Members get
// one record per day at their first punch; staff get their first punch as the
// time in and their last as the time out. Returns records created.
export async function applyPunches(pins: string[]): Promise<number> {
  let created = 0;
  for (const pin of new Set(pins)) {
    const member_id = await findMemberId(pin);
    if (member_id) {
      created += await applyMemberPunches(pin, member_id);
      continue;
    }
    const staff = await prisma.staff.findFirst({ where: { biometricId: pin }, select: { id: true } });
    if (staff) created += await applyStaffPunches(pin, staff.id);
  }
  return created;
}

async function applyMemberPunches(pin: string, member_id: string): Promise<number> {
  const punches = await prisma.biometricPunch.findMany({
    where: { pin, member_id: null, staff_id: null },
    orderBy: { time: "asc" },
  });
  const firstOfDay = new Map<string, string>();
  for (const punch of punches) {
    if (!firstOfDay.has(punch.date)) firstOfDay.set(punch.date, punch.time);
  }
  // Days already checked in (at the desk, or by another upload arriving at
  // the same moment) are skipped by the one-per-day unique key.
  const { count } = await prisma.attendance.createMany({
    data: [...firstOfDay].map(([date, time]) => ({ member_id, date, time })),
    skipDuplicates: true,
  });
  await prisma.biometricPunch.updateMany({
    where: { pin, member_id: null, staff_id: null },
    data: { member_id },
  });
  return count;
}

// A second punch this soon after the first is a double tap, not leaving.
const MIN_SHIFT_MINUTES = 5;
const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

async function applyStaffPunches(pin: string, staff_id: string): Promise<number> {
  let created = 0;
  const fresh = await prisma.biometricPunch.findMany({
    where: { pin, member_id: null, staff_id: null },
    select: { date: true },
  });
  for (const date of new Set(fresh.map((p) => p.date))) {
    // Recomputed from every punch of the day, so late uploads still count.
    const day = await prisma.biometricPunch.findMany({
      where: { pin, date },
      orderBy: { time: "asc" },
      select: { time: true },
    });
    const inTime = day[0].time;
    const last = day[day.length - 1].time;
    const outTime = minutes(last) - minutes(inTime) >= MIN_SHIFT_MINUTES ? last : null;
    const existing = await prisma.staffAttendance.findFirst({ where: { staff_id, date } });
    if (existing) {
      await prisma.staffAttendance.update({ where: { id: existing.id }, data: { inTime, outTime } });
    } else {
      try {
        await prisma.staffAttendance.create({ data: { staff_id, date, inTime, outTime } });
        created++;
      } catch (error) {
        // Marked in at the same moment by the desk or another upload.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
        await prisma.staffAttendance.updateMany({ where: { staff_id, date }, data: { inTime, outTime } });
      }
    }
  }
  await prisma.biometricPunch.updateMany({
    where: { pin, member_id: null, staff_id: null },
    data: { staff_id },
  });
  return created;
}

export async function ingestPunches(
  deviceSerial: string,
  text: string
): Promise<{ received: number; attendance: number }> {
  const punches = parsePunches(text);
  if (punches.length === 0) return { received: 0, attendance: 0 };
  await prisma.biometricPunch.createMany({
    data: punches.map((punch) => ({ ...punch, deviceSerial })),
    skipDuplicates: true,
  });
  const attendance = await applyPunches(punches.map((punch) => punch.pin));
  return { received: punches.length, attendance };
}
