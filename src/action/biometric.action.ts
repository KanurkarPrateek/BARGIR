"use server";

import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
import base from "@/lib/prisma";
import prisma, { requireGymId, requireOwner } from "@/lib/tenant";
import { commandFor, nextMachineId, queueForAllMachines } from "@/lib/biometric-commands";
import { FILE_IMPORT_SERIAL, applyPunches, ingestPunches } from "@/lib/biometric";
import { networkInterfaces } from "os";

export interface DeviceResponse {
  serial: string;
  // Null until the machine has contacted the server for the first time.
  lastSeenAt: Date | null;
}

export interface UnlinkedId {
  pin: string;
  // Name stored on the machine, when it has shared one.
  deviceName: string | null;
  punches: number;
  lastDate: string;
  lastTime: string;
}

export interface ServerAddress {
  address: string | null;
  port: string | null;
  // True when the address is a name rather than an IP, which the machine
  // needs to be told ("Enable domain name").
  isDomain: boolean;
}

// What to type into the machine. When hosted (Kubernetes, cloud) the address
// comes from configuration; on a gym computer it is that computer's address
// on the local network, since `localhost` is no use to the machine.
export async function GetServerAddress(): Promise<ServerAddress> {
  const configured = process.env.BIOMETRIC_SERVER_ADDRESS;
  if (configured) {
    return {
      address: configured,
      port: process.env.BIOMETRIC_SERVER_PORT ?? "80",
      isDomain: !/^[\d.]+$/.test(configured),
    };
  }
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return { address: address.address, port: null, isDomain: false };
      }
    }
  }
  return { address: null, port: null, isDomain: false };
}

// Machines are not gym-scoped automatically (they are found by serial before
// the gym is known), so these filter by gym by hand.
export async function GetDevices(): Promise<DeviceResponse[]> {
  return base.biometricDevice.findMany({
    where: { gym_id: await requireGymId() },
    orderBy: { createdAt: "asc" },
    select: { serial: true, lastSeenAt: true },
  });
}

// Claims a machine for this gym by the serial number on its sticker. From
// then on, punches from that machine belong to this gym.
export async function RegisterDevice(serial: string): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    serial = serial.trim();
    if (!/^[\w-]{4,40}$/.test(serial)) {
      throw new UserError("Enter the serial number exactly as printed on the machine");
    }
    const gym_id = await requireGymId();
    const existing = await base.biometricDevice.findUnique({ where: { serial } });
    if (existing && !existing.gym_id) {
      await base.biometricDevice.update({ where: { serial }, data: { gym_id } });
      return;
    }
    if (existing) {
      throw new UserError(
        existing.gym_id === gym_id
          ? "This machine is already added"
          : "This machine is registered to another gym"
      );
    }
    await base.biometricDevice.create({ data: { serial, gym_id } });
  });
}

export async function RemoveDevice(serial: string): Promise<void> {
  await requireOwner();
  await base.biometricDevice.deleteMany({
    where: { serial, gym_id: await requireGymId() },
  });
}

// dd-MM-yyyy dates do not sort as text, so flip them to yyyy-MM-dd first.
const sortKey = (punch: { date: string; time: string }) =>
  `${punch.date.split("-").reverse().join("-")} ${punch.time}`;

// Machine IDs that have punched but do not belong to any member yet.
export async function GetUnlinkedIds(): Promise<UnlinkedId[]> {
  const punches = await prisma.biometricPunch.findMany({
    where: { member_id: null, staff_id: null },
  });
  const names = new Map(
    (await prisma.biometricUser.findMany()).map((user) => [user.pin, user.name])
  );

  const ids = new Map<string, UnlinkedId>();
  for (const punch of punches) {
    const entry = ids.get(punch.pin);
    if (entry) {
      entry.punches++;
      if (sortKey(punch) > sortKey({ date: entry.lastDate, time: entry.lastTime })) {
        entry.lastDate = punch.date;
        entry.lastTime = punch.time;
      }
    } else {
      ids.set(punch.pin, {
        pin: punch.pin,
        deviceName: names.get(punch.pin) ?? null,
        punches: 1,
        lastDate: punch.date,
        lastTime: punch.time,
      });
    }
  }
  return [...ids.values()];
}

export type PersonKind = "member" | "staff";

// Who a machine ID belongs to, if anyone, across members and staff.
async function holderOf(pin: string) {
  const member = await prisma.member.findFirst({ where: { biometricId: pin }, select: { id: true, name: true } });
  if (member) return { kind: "member" as const, ...member };
  const staff = await prisma.staff.findFirst({ where: { biometricId: pin }, select: { id: true, name: true } });
  return staff ? { kind: "staff" as const, ...staff } : null;
}

// Links a machine ID to a member or staff member and marks attendance for the
// punches that were waiting for it. Returns how many records were created.
export async function LinkBiometricId(
  pin: string,
  personId: string,
  kind: PersonKind = "member"
): Promise<number | Failed> {
  return safe(async () => {
    pin = pin.trim();
    if (!pin) throw new UserError("Enter the ID used on the machine");

    const holder = await holderOf(pin);
    if (holder && holder.id !== personId) {
      throw new UserError(`Machine ID ${pin} is already linked to ${holder.name}`);
    }
    if (kind === "member") {
      await prisma.member.update({ where: { id: personId }, data: { biometricId: pin } });
    } else {
      await prisma.staff.update({ where: { id: personId }, data: { biometricId: pin } });
    }
    return applyPunches([pin]);
  });
}

export async function UnlinkBiometricId(personId: string, kind: PersonKind = "member"): Promise<void> {
  if (kind === "member") {
    await prisma.member.update({ where: { id: personId }, data: { biometricId: null } });
  } else {
    await prisma.staff.update({ where: { id: personId }, data: { biometricId: null } });
  }
}

export interface LinkedPerson {
  id: string;
  name: string;
  kind: PersonKind;
  biometricId: string;
}

export async function GetLinkedPeople(): Promise<LinkedPerson[]> {
  const [members, staff] = await Promise.all([
    prisma.member.findMany({ where: { biometricId: { not: null } }, select: { id: true, name: true, biometricId: true } }),
    prisma.staff.findMany({ where: { biometricId: { not: null } }, select: { id: true, name: true, biometricId: true } }),
  ]);
  return [
    ...members.map((m) => ({ id: m.id, name: m.name, kind: "member" as const, biometricId: m.biometricId! })),
    ...staff.map((s) => ({ id: s.id, name: s.name, kind: "staff" as const, biometricId: s.biometricId! })),
  ].sort((a, b) => Number(a.biometricId) - Number(b.biometricId) || a.biometricId.localeCompare(b.biometricId));
}

// ---------- commands to the machines ----------

export interface CommandRow {
  id: string;
  deviceSerial: string;
  label: string;
  status: "pending" | "sent" | "done" | "failed";
  returnCode: string | null;
  createdAt: Date;
  doneAt: Date | null;
}

export async function GetCommands(): Promise<CommandRow[]> {
  return prisma.biometricCommand.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, deviceSerial: true, label: true, status: true, returnCode: true, createdAt: true, doneAt: true },
  });
}

// Puts a member on every machine of the gym under their machine ID, giving
// them the next free ID if they have none. Returns that ID.
export async function AddMemberToMachines(member_id: string): Promise<string | Failed> {
  return safe(async () => {
    const member = await prisma.member.findUnique({ where: { id: member_id } });
    if (!member) throw new UserError("Member not found");
    if (member.blacklisted) throw new UserError(`${member.name} is blacklisted`);
    const pin = member.biometricId ?? (await nextMachineId());
    const machines = await queueForAllMachines(`Add ${member.name} (ID ${pin})`, commandFor.addUser(pin, member.name));
    if (machines === 0) throw new UserError("Add your biometric machine first (Attendance → Biometric)");
    await prisma.member.update({ where: { id: member.id }, data: { biometricId: pin, machineBlocked: false } });
    return pin;
  });
}

// Takes a member off every machine (their fingerprints go too).
export async function RemoveMemberFromMachines(member_id: string): Promise<void | Failed> {
  return safe(async () => {
    const member = await prisma.member.findUnique({ where: { id: member_id } });
    if (!member?.biometricId) throw new UserError("This member is not on the machine");
    await queueForAllMachines(`Remove ${member.name} (ID ${member.biometricId})`, commandFor.removeUser(member.biometricId));
    await prisma.member.update({ where: { id: member.id }, data: { machineBlocked: true } });
  });
}

// Asks the machines for everyone enrolled on them, so names show up next to
// machine IDs when linking an existing machine's people to members.
export async function RequestMachineUserList(): Promise<number | Failed> {
  return safe(async () => {
    const machines = await queueForAllMachines("Send the list of enrolled people", commandFor.listUsers());
    if (machines === 0) throw new UserError("Add your biometric machine first");
    return machines;
  });
}

export async function GetAutoBlock(): Promise<boolean> {
  const gym = await base.gym.findUnique({ where: { id: await requireGymId() }, select: { autoBlockExpired: true } });
  return gym?.autoBlockExpired ?? false;
}

export async function SetAutoBlock(enabled: boolean): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    await base.gym.update({ where: { id: await requireGymId() }, data: { autoBlockExpired: enabled } });
  });
}

// Imports the attendance file exported from the machine to a pen drive.
export async function ImportPunchFile(
  content: string
): Promise<{ received: number; attendance: number } | Failed> {
  return safe(async () => {
    const result = await ingestPunches(FILE_IMPORT_SERIAL, content);
    if (result.received === 0) {
      throw new UserError("No punches found. Export the attendance log (attlog .dat) from the machine.");
    }
    return result;
  });
}

// Delete Biometric: removes the person from every machine and frees their
// machine ID in the software. Past attendance is kept.
export async function DeleteFromMachines(personId: string, kind: PersonKind): Promise<void | Failed> {
  return safe(async () => {
    const person =
      kind === "member"
        ? await prisma.member.findUnique({ where: { id: personId }, select: { name: true, biometricId: true } })
        : await prisma.staff.findUnique({ where: { id: personId }, select: { name: true, biometricId: true } });
    if (!person?.biometricId) throw new UserError("Not on the machine");
    await queueForAllMachines(`Delete ${person.name} (ID ${person.biometricId})`, commandFor.removeUser(person.biometricId));
    if (kind === "member") {
      await prisma.member.update({ where: { id: personId }, data: { biometricId: null, machineBlocked: false } });
    } else {
      await prisma.staff.update({ where: { id: personId }, data: { biometricId: null } });
    }
  });
}

// Puts a staff member on the machines (Add Biometric for staff).
export async function AddStaffToMachines(staff_id: string): Promise<string | Failed> {
  return safe(async () => {
    const staff = await prisma.staff.findUnique({ where: { id: staff_id } });
    if (!staff) throw new UserError("Staff member not found");
    const pin = staff.biometricId ?? (await nextMachineId());
    const machines = await queueForAllMachines(`Add staff ${staff.name} (ID ${pin})`, commandFor.addUser(pin, staff.name));
    if (machines === 0) throw new UserError("Add your biometric machine first (Machine Setup)");
    await prisma.staff.update({ where: { id: staff.id }, data: { biometricId: pin } });
    return pin;
  });
}
