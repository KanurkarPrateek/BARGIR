// Access check for the Control Panel (control/), the internal app that
// creates and manages gyms on this deployment. It calls /api/platform/*
// with "Authorization: Bearer <PLATFORM_API_KEY>".
import { timingSafeEqual } from "crypto";

export function platformAuthorized(request: Request): boolean {
  const key = process.env.PLATFORM_API_KEY;
  if (!key || key.length < 24) return false;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(given), b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });
