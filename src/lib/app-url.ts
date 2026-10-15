import { headers } from "next/headers";

// Public address of the app, for links in messages and emails. Set APP_URL
// when the app sits behind a custom domain; otherwise it is worked out from
// the hosting platform or from the request being handled.
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
  } catch {
    // Not inside a request (a scheduled run).
  }
  return "";
}
