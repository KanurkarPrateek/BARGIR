// Endpoint eSSL / ZKTeco / BioMax machines talk to when "Cloud Server" (ADMS)
// is set to this server's address. Every gym's machine uses the same address;
// the serial number it reports decides which gym the punches belong to.
import base from "@/lib/prisma";
import { ingestPunches, saveDeviceUsers } from "@/lib/biometric";
import { runAsGym } from "@/lib/tenant";
import { NextRequest } from "next/server";

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });

// Whole hours are sent as hours, anything else (e.g. India, +5:30) in minutes.
function deviceTimeZone(): number {
  const minutes = -new Date().getTimezoneOffset();
  return minutes % 60 === 0 ? minutes / 60 : minutes;
}

// Null for a machine no gym has registered.
async function knownDevice(serial: string | null) {
  if (!serial) return null;
  const device = await base.biometricDevice.findUnique({ where: { serial } });
  if (!device) return null;
  return base.biometricDevice.update({
    where: { serial },
    data: { lastSeenAt: new Date() },
  });
}

export async function GET(request: NextRequest) {
  const serial = request.nextUrl.searchParams.get("SN");
  const device = await knownDevice(serial);

  // An unregistered machine still gets a valid reply, so it keeps trying and
  // connects by itself as soon as a gym adds its serial number.
  return text(
    [
      `GET OPTION FROM: ${serial ?? ""}`,
      `Stamp=${device?.attlogStamp ?? 0}`,
      `ATTLOGStamp=${device?.attlogStamp ?? 0}`,
      "OpStamp=0",
      "OPERLOGStamp=0",
      // Seconds between the machine's idle check-ins. Punches are still sent
      // the moment they happen (Realtime=1); a slow check-in just keeps the
      // request count low enough for free hosting plans.
      "ErrorDelay=60",
      "Delay=60",
      "TransTimes=00:00;14:05",
      "TransInterval=1",
      "TransFlag=TransData AttLog OpLog EnrollUser ChgUser",
      `TimeZone=${deviceTimeZone()}`,
      "Realtime=1",
      "Encrypt=None",
    ].join("\n") + "\n"
  );
}

export async function POST(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const device = await knownDevice(params.get("SN"));

  // An error makes the machine keep its punches and retry, so nothing is
  // lost while it waits for a gym to register it.
  if (!device) return text("Device not registered", 403);

  const body = await request.text();
  const table = params.get("table");

  return runAsGym(device.gym_id, async () => {
    if (table === "ATTLOG") {
      const { received } = await ingestPunches(device.serial, body);
      const stamp = params.get("Stamp");
      if (stamp) {
        await base.biometricDevice.update({
          where: { serial: device.serial },
          data: { attlogStamp: stamp },
        });
      }
      return text(`OK: ${received}`);
    }

    // The user list arrives as OPERLOG, or as USERINFO when it was asked for.
    if (table === "OPERLOG" || table === "USERINFO") await saveDeviceUsers(body);
    return text("OK");
  });
}
