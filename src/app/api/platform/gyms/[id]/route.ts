// Suspend or resume a gym, or reset its owner's password.
import base from "@/lib/prisma";
import { hashPassword } from "@/lib/session";
import { platformAuthorized, unauthorized } from "@/lib/platform";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!platformAuthorized(request)) return unauthorized();
  const { id } = await params;
  const gym = await base.gym.findUnique({ where: { id } });
  if (!gym) return Response.json({ error: "Gym not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.active === "boolean") {
    await base.gym.update({ where: { id }, data: { active: body.active } });
  }
  if (body.ownerPassword !== undefined) {
    if (String(body.ownerPassword).length < 8) return Response.json({ error: "Password needs at least 8 characters" }, { status: 400 });
    const { count } = await base.user.updateMany({ where: { gym_id: id, role: "owner" }, data: { passwordHash: hashPassword(String(body.ownerPassword)) } });
    if (count === 0) return Response.json({ error: "This gym has no owner login" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
