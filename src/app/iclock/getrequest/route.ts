// Machines check in here every minute. The reply carries any commands waiting
// for that machine (add or remove a person, send the user list), one per line
// as "C:<number>:<command>"; "OK" when there is nothing to do.
import prisma from "@/lib/prisma"; // not gym-scoped: looked up by serial
import { NextRequest } from "next/server";

// A slow machine should not be handed a pile of work in one go.
const MAX_PER_CHECKIN = 10;

const text = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/plain" } });

export async function GET(request: NextRequest) {
  const serial = request.nextUrl.searchParams.get("SN");
  if (!serial) return text("OK");
  const device = await prisma.biometricDevice.findUnique({ where: { serial } });
  if (!device) return text("OK");
  await prisma.biometricDevice.update({ where: { serial }, data: { lastSeenAt: new Date() } });

  const commands = await prisma.biometricCommand.findMany({
    where: { deviceSerial: serial, status: "pending" },
    orderBy: { seq: "asc" },
    take: MAX_PER_CHECKIN,
  });
  if (commands.length === 0) return text("OK");
  await prisma.biometricCommand.updateMany({
    where: { id: { in: commands.map((c) => c.id) } },
    data: { status: "sent", sentAt: new Date() },
  });
  return text(commands.map((c) => `C:${c.seq}:${c.command}`).join("\n") + "\n");
}
