// Instructions for the gym's biometric machines (ZKTeco / eSSL / BioMax push
// protocol). Commands wait in the database; each machine picks up its own on
// the next check-in (/iclock/getrequest) and reports the result
// (/iclock/devicecmd).
import base from "@/lib/prisma";
import prisma, { requireGymId } from "@/lib/tenant";
import { membershipStatus } from "@/lib/membership";

// Names travel in a tab-separated line; keep them to plain printable text.
const clean = (text: string) => text.replace(/[\t\r\n]/g, " ").slice(0, 24);

export const commandFor = {
  // Creates the person on the machine, or updates their name.
  addUser: (pin: string, name: string) =>
    `DATA UPDATE USERINFO PIN=${pin}\tName=${clean(name)}\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000100000000\tVerify=0`,
  // Removes the person and their fingerprints from the machine.
  removeUser: (pin: string) => `DATA DELETE USERINFO PIN=${pin}`,
  // Asks the machine to send its full list of enrolled people.
  listUsers: () => "DATA QUERY USERINFO",
};

// Queues a command for every machine of the current gym. Returns how many
// machines it was queued for.
export async function queueForAllMachines(label: string, command: string): Promise<number> {
  const gym_id = await requireGymId();
  const devices = await base.biometricDevice.findMany({ where: { gym_id }, select: { serial: true } });
  if (devices.length === 0) return 0;
  await prisma.biometricCommand.createMany({
    data: devices.map((device) => ({ deviceSerial: device.serial, label, command })),
  });
  return devices.length;
}

// Next free numeric machine ID in this gym. IDs already used on a machine by
// someone not linked yet (seen in punches or the machine's user list) are
// skipped too, or their old punches would be credited to the new person.
export async function nextMachineId(): Promise<string> {
  const [members, staff, machineUsers, punches] = await Promise.all([
    prisma.member.findMany({ where: { biometricId: { not: null } }, select: { biometricId: true } }),
    prisma.staff.findMany({ where: { biometricId: { not: null } }, select: { biometricId: true } }),
    prisma.biometricUser.findMany({ select: { pin: true } }),
    prisma.biometricPunch.findMany({ distinct: ["pin"], select: { pin: true } }),
  ]);
  const used = [
    ...members.map((r) => r.biometricId),
    ...staff.map((r) => r.biometricId),
    ...machineUsers.map((r) => r.pin),
    ...punches.map((r) => r.pin),
  ]
    .map(Number)
    .filter((n) => Number.isInteger(n));
  return String(Math.max(0, ...used) + 1);
}

// With auto-block on, members whose membership has ended are taken off the
// machines so the door or turnstile stops letting them in.
export async function autoBlockExpiredMembers(): Promise<number> {
  const gym = await base.gym.findUnique({ where: { id: await requireGymId() }, select: { autoBlockExpired: true } });
  if (!gym?.autoBlockExpired) return 0;
  const members = await prisma.member.findMany({
    where: { biometricId: { not: null }, machineBlocked: false },
    select: { id: true, name: true, biometricId: true, sales: { select: { endDate: true } } },
  });
  let blocked = 0;
  for (const member of members) {
    // People who never bought a plan are left alone (trial, staff family...).
    if (member.sales.length === 0 || membershipStatus(member.sales).state !== "expired") continue;
    await queueForAllMachines(`Membership ended: remove ${member.name} (ID ${member.biometricId})`, commandFor.removeUser(member.biometricId!));
    await prisma.member.update({ where: { id: member.id }, data: { machineBlocked: true } });
    blocked++;
  }
  return blocked;
}

// Puts a member back on the machines after a renewal or un-blacklisting, if
// they had been taken off. They need to enroll their finger again.
export async function restoreToMachines(member_id: string): Promise<boolean> {
  const member = await prisma.member.findUnique({ where: { id: member_id } });
  if (!member?.biometricId || !member.machineBlocked || member.blacklisted) return false;
  await queueForAllMachines(`Renewed: add ${member.name} back (ID ${member.biometricId})`, commandFor.addUser(member.biometricId, member.name));
  await prisma.member.update({ where: { id: member.id }, data: { machineBlocked: false } });
  return true;
}
