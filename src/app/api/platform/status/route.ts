// Health of this deployment, for the Control Panel's cluster page.
import base from "@/lib/prisma";
import { platformAuthorized, unauthorized } from "@/lib/platform";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!platformAuthorized(request)) return unauthorized();
  const started = Date.now();
  let database = false, gyms = 0;
  try {
    gyms = await base.gym.count();
    database = true;
  } catch {}
  let sender: "ok" | "unreachable" | "not configured" = "not configured";
  if (process.env.WHATSAPP_WORKER_URL) {
    try {
      const res = await fetch(`${process.env.WHATSAPP_WORKER_URL.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
      sender = res.ok ? "ok" : "unreachable";
    } catch {
      sender = "unreachable";
    }
  }
  return Response.json({
    ok: database,
    database,
    sender,
    gyms,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    signupOpen: process.env.ALLOW_SIGNUP !== "false",
    responseMs: Date.now() - started,
  });
}
