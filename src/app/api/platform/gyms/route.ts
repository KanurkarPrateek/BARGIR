// List gyms on this deployment with usage numbers, or create one.
import base from "@/lib/prisma";
import { normalizeIndianMobile } from "@/lib/phone";
import { hashPassword } from "@/lib/session";
import { platformAuthorized, unauthorized } from "@/lib/platform";
import { createDefaultWorkflows } from "@/lib/whatsapp/defaults";
import { membershipStatus, parseDate } from "@/lib/membership";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!platformAuthorized(request)) return unauthorized();
  const gyms = await base.gym.findMany({ orderBy: { createdAt: "asc" }, include: { users: { where: { role: "owner" }, take: 1 } } });
  const result = [];
  for (const gym of gyms) {
    const [members, attendance, payments, machines, whatsapp] = await Promise.all([
      base.member.findMany({ where: { gym_id: gym.id }, select: { sales: { select: { endDate: true } } } }),
      base.attendance.findMany({ where: { gym_id: gym.id }, select: { date: true }, orderBy: { createdAt: "desc" }, take: 200 }),
      base.payment.findMany({ where: { gym_id: gym.id }, select: { date: true }, orderBy: { createdAt: "desc" }, take: 200 }),
      base.biometricDevice.count({ where: { gym_id: gym.id } }),
      base.whatsappAuth.count({ where: { gym_id: gym.id, key: "creds" } }),
    ]);
    const dates = [...attendance, ...payments].map((r) => parseDate(r.date)).filter((d) => !isNaN(d.getTime()));
    const last = dates.reduce<Date | null>((a, b) => (!a || b > a ? b : a), null);
    result.push({
      id: gym.id,
      name: gym.name,
      active: gym.active,
      setupDone: gym.setupDone,
      createdAt: gym.createdAt,
      ownerName: gym.users[0]?.name ?? null,
      ownerPhone: gym.users[0]?.phone.toString() ?? null,
      members: members.length,
      activeMembers: members.filter((m) => ["active", "expiring"].includes(membershipStatus(m.sales).state)).length,
      lastActivity: last ? last.toISOString() : null,
      machines,
      whatsappLinked: whatsapp > 0,
    });
  }
  return Response.json({ gyms: result });
}

export async function POST(request: Request) {
  if (!platformAuthorized(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const ownerName = String(body.ownerName ?? "").trim();
  const password = String(body.password ?? "");
  const phone = normalizeIndianMobile(body.ownerPhone);
  if (!name || !ownerName) return Response.json({ error: "Gym name and owner name are required" }, { status: 400 });
  if (!phone) return Response.json({ error: "Owner phone must be a 10-digit Indian mobile number" }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "Password needs at least 8 characters" }, { status: 400 });
  if (await base.user.findUnique({ where: { phone: BigInt(phone) } })) {
    return Response.json({ error: "That phone number already has a login on this cluster" }, { status: 409 });
  }
  const gym = await base.gym.create({
    data: {
      name,
      phone: BigInt(phone),
      users: { create: { name: ownerName, phone: BigInt(phone), passwordHash: hashPassword(password), role: "owner" } },
    },
  });
  await createDefaultWorkflows(gym.id);
  return Response.json({ id: gym.id, name: gym.name }, { status: 201 });
}
