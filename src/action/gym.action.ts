"use server";

import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
// Platform admin only: creating and managing the gyms that use the software.
import base from "@/lib/prisma";
import { requireIndianMobile } from "@/lib/phone";
import { getSession, hashPassword, setSession } from "@/lib/session";
import { createDefaultWorkflows } from "@/lib/whatsapp/defaults";

export interface GymInput {
  name: string;
  ownerName: string;
  ownerPhone: string;
  password: string;
}

export interface GymResponse {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  ownerName: string | null;
  ownerPhone: string | null;
  members: number;
  machines: number;
}

async function requireSuperadmin() {
  const session = await getSession();
  if (session?.role !== "superadmin") throw new UserError("Not allowed");
  return session;
}

export async function ListGyms(): Promise<GymResponse[]> {
  await requireSuperadmin();
  const [gyms, members, machines] = await Promise.all([
    base.gym.findMany({
      orderBy: { createdAt: "desc" },
      include: { users: { where: { role: "owner" }, take: 1 } },
    }),
    base.member.groupBy({ by: ["gym_id"], _count: true }),
    base.biometricDevice.groupBy({ by: ["gym_id"], _count: true }),
  ]);
  const count = (rows: { gym_id: string; _count: number }[], id: string) =>
    rows.find((row) => row.gym_id === id)?._count ?? 0;

  return gyms.map((gym) => ({
    id: gym.id,
    name: gym.name,
    active: gym.active,
    createdAt: gym.createdAt,
    ownerName: gym.users[0]?.name ?? null,
    ownerPhone: gym.users[0]?.phone.toString() ?? null,
    members: count(members, gym.id),
    machines: count(machines, gym.id),
  }));
}

// Creates the gym, its owner's login, and the starter WhatsApp workflows.
export async function CreateGym(data: GymInput): Promise<void | Failed> {
  return safe(async () => {
    await requireSuperadmin();
    if (!data.name.trim()) throw new UserError("Enter the gym's name");
    if (!data.ownerName.trim()) throw new UserError("Enter the owner's name");
    if (data.password.length < 8) throw new UserError("Password needs at least 8 characters");
    const phone = requireIndianMobile(data.ownerPhone);
    if (await base.user.findUnique({ where: { phone } })) {
      throw new UserError("That phone number already has a login");
    }

    const gym = await base.gym.create({
      data: {
        name: data.name.trim(),
        phone,
        users: {
          create: {
            name: data.ownerName.trim(),
            phone,
            passwordHash: hashPassword(data.password),
            role: "owner",
          },
        },
      },
    });
    await createDefaultWorkflows(gym.id);
  });
}

// An inactive gym cannot sign in and gets no automatic messages. Its data stays.
export async function SetGymActive(id: string, active: boolean): Promise<void> {
  await requireSuperadmin();
  await base.gym.update({ where: { id }, data: { active } });
}

export async function ResetOwnerPassword(gymId: string, password: string): Promise<void | Failed> {
  return safe(async () => {
    await requireSuperadmin();
    if (password.length < 8) throw new UserError("Password needs at least 8 characters");
    const { count } = await base.user.updateMany({
      where: { gym_id: gymId, role: "owner" },
      data: { passwordHash: hashPassword(password) },
    });
    if (count === 0) throw new UserError("This gym has no owner login");
  });
}

// Lets the platform admin work inside one gym, e.g. to help with setup.
export async function EnterGym(gymId: string | null): Promise<void | Failed> {
  return safe(async () => {
    const session = await requireSuperadmin();
    if (gymId && !(await base.gym.findUnique({ where: { id: gymId } }))) {
      throw new UserError("Gym not found");
    }
    await setSession({ userId: session.userId, name: session.name, role: session.role, gymId });
  });
}
