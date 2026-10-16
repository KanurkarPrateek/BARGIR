// A gym's logins (owner and reception): list them, or add one.
import base from "@/lib/prisma";
import { hashPassword } from "@/lib/session";
import { platformAuthorized, unauthorized } from "@/lib/platform";
import { listLogins, loginErrorResponse, LoginError, phoneFree, readPassword, readPhone, readRole, staffFor } from "@/lib/platform-logins";

export const dynamic = "force-dynamic";

async function gymOr404(id: string) {
  const gym = await base.gym.findUnique({ where: { id }, select: { id: true } });
  if (!gym) throw new LoginError("Gym not found", 404);
  return gym;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!platformAuthorized(request)) return unauthorized();
  try {
    const gym = await gymOr404((await params).id);
    return Response.json({ logins: await listLogins(gym.id) });
  } catch (error) {
    return loginErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!platformAuthorized(request)) return unauthorized();
  try {
    const gym = await gymOr404((await params).id);
    const body = await request.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    if (!name) throw new LoginError("Enter the person's name");
    const role = readRole(body.role);
    const phone = readPhone(body.phone);
    const password = readPassword(body.password);
    await phoneFree(phone);
    const staff_id = role === "staff" ? await staffFor(gym.id, name, phone) : null;
    const user = await base.user.create({
      data: { gym_id: gym.id, name, phone, role, staff_id, passwordHash: hashPassword(password) },
    });
    return Response.json({ id: user.id }, { status: 201 });
  } catch (error) {
    return loginErrorResponse(error);
  }
}
