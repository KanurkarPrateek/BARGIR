export async function register() {
  // See src/lib/prisma.ts: the app runs on the gym's local time everywhere.
  process.env.TZ = process.env.APP_TIMEZONE ?? "Asia/Kolkata";
}
