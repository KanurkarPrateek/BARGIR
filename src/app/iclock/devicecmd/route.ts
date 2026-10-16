// The machine reports what happened to each command it was given, one line
// per command: "ID=<number>&Return=<code>&CMD=<name>". A code of 0 or more
// means it worked.
import prisma from "@/lib/prisma"; // not gym-scoped: looked up by serial
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const serial = request.nextUrl.searchParams.get("SN");
  // Results are only taken from a machine a gym has claimed, and only for
  // commands that gym sent to that machine and that are waiting for a result.
  const device = serial ? await prisma.biometricDevice.findUnique({ where: { serial } }) : null;
  if (!device?.gym_id) return new Response("OK", { headers: { "Content-Type": "text/plain" } });
  const body = await request.text();
  for (const line of body.split(/\r?\n/)) {
    const fields = new URLSearchParams(line.trim());
    const seq = Number(fields.get("ID"));
    const code = fields.get("Return");
    if (!Number.isInteger(seq) || code === null || !/^-?\d{1,10}$/.test(code)) continue;
    await prisma.biometricCommand.updateMany({
      where: { deviceSerial: device.serial, gym_id: device.gym_id, seq, status: "sent" },
      data: { status: Number(code) >= 0 ? "done" : "failed", returnCode: code, doneAt: new Date() },
    });
  }
  return new Response("OK", { headers: { "Content-Type": "text/plain" } });
}
