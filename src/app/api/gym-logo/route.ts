// The signed-in gym's logo as an image. Pages link to it with ?v=<last
// change> so the browser keeps it and only fetches it again after a change,
// instead of every page carrying the whole logo.
import base from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const gymId = (await getSession())?.gymId;
  const gym = gymId ? await base.gym.findUnique({ where: { id: gymId }, select: { logo: true } }) : null;
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(gym?.logo ?? "");
  if (!m) return new Response("No logo", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
