// Change one login of a gym (name, phone, role, password), or remove it.
// Any change to the password, role or the login itself signs that person out
// everywhere within a minute (src/lib/session.ts).
import base from "@/lib/prisma";
import { hashPassword } from "@/lib/session";
import { platformAuthorized, unauthorized } from "@/lib/platform";
import { keepsAnOwner, loginErrorResponse, LoginError, phoneFree, readPassword, readPhone, readRole, staffFor } from "@/lib/platform-logins";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; userId: string }> };

async function loginOr404(params: Params["params"]) {
  const { id, userId } = await params;
  const user = await base.user.findFirst({ where: { id: userId, gym_id: id } });
  if (!user) throw new LoginError("Login not found", 404);
  return user;
}

export async function PATCH(request: Request, { params }: Params) {
  if (!platformAuthorized(request)) return unauthorized();
  try {
    const user = await loginOr404(params);
    const body = await request.json().catch(() => ({}));
    const data: { name?: string; phone?: bigint; role?: "owner" | "staff"; staff_id?: string | null; passwordHash?: string } = {};
    if (body.name !== undefined) {
      data.name = String(body.name).trim();
      if (!data.name) throw new LoginError("Enter the person's name");
    }
    if (body.phone !== undefined) {
      data.phone = readPhone(body.phone);
      await phoneFree(data.phone, user.id);
    }
    if (body.password !== undefined) data.passwordHash = hashPassword(readPassword(body.password));
    if (body.role !== undefined) {
      const role = readRole(body.role);
      if (role !== user.role) {
        if (role === "staff") {
          await keepsAnOwner(user.gym_id, user.id);
          data.staff_id = await staffFor(user.gym_id, data.name ?? user.name, data.phone ?? user.phone);
        } else {
          data.staff_id = null;
        }
        data.role = role;
      }
    }
    await base.user.update({ where: { id: user.id }, data });
    // Keep the reception person's Staff entry in step with their login.
    const staffId = data.staff_id === undefined ? user.staff_id : data.staff_id;
    if (staffId && (data.name || data.phone)) {
      await base.staff.update({ where: { id: staffId }, data: { name: data.name, phone: data.phone } });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return loginErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!platformAuthorized(request)) return unauthorized();
  try {
    const user = await loginOr404(params);
    if (user.role === "owner") await keepsAnOwner(user.gym_id, user.id);
    await base.user.delete({ where: { id: user.id } });
    return Response.json({ ok: true });
  } catch (error) {
    return loginErrorResponse(error);
  }
}
