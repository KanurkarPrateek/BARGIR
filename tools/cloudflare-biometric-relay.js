// Cloudflare Worker for biometric machines that can only send plain HTTP.
//
// Vercel accepts HTTPS only, and many attendance machines cannot do HTTPS.
// This worker sits on a hostname of yours (e.g. punch.example.com), accepts
// the machine's plain HTTP calls, and passes them to the app over HTTPS.
//
// Setup (Cloudflare free plan):
//   1. Workers & Pages > Create Worker, paste this file, deploy.
//   2. Worker > Settings > Variables: APP_URL = https://your-app.vercel.app
//   3. Worker > Settings > Domains & Routes: add punch.yourdomain.com
//   4. Rules > Configuration Rules: for hostname punch.yourdomain.com,
//      turn "Always Use HTTPS" OFF (otherwise Cloudflare redirects the machine).
//   5. On the machine: server address punch.yourdomain.com, port 80,
//      domain name ON, HTTPS OFF.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Only the machine's endpoint is relayed; the app itself stays HTTPS-only.
    if (!url.pathname.startsWith("/iclock/")) {
      return new Response("Not found", { status: 404 });
    }
    const target = env.APP_URL.replace(/\/$/, "") + url.pathname + url.search;
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    return fetch(target, {
      method: request.method,
      headers: { "Content-Type": request.headers.get("Content-Type") ?? "text/plain" },
      body: hasBody ? await request.text() : undefined,
    });
  },
};
