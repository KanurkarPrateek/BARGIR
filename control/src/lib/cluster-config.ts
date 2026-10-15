// The full technical setup of one cluster: which values go into its Vercel
// project and its Render sender. Kept encrypted in the Control Panel so any
// cluster can be rebuilt or checked later.
import { randomBytes } from "crypto";
import { decrypt, encrypt, newPassword } from "./crypto";

export interface ClusterSecrets {
  databaseUrl: string;   // Supabase transaction pooler (port 6543, ?pgbouncer=true&connection_limit=1)
  directUrl: string;     // Supabase session pooler (port 5432)
  sessionSecret: string;
  workerKey: string;
  cronSecret: string;
  superadminLogin: string;
  superadminPassword: string;
}

export const SECRET_FIELDS: { key: keyof ClusterSecrets; label: string; hint?: string }[] = [
  { key: "databaseUrl", label: "Supabase transaction pooler URL", hint: "port 6543, ending with ?pgbouncer=true&connection_limit=1" },
  { key: "directUrl", label: "Supabase session pooler URL", hint: "port 5432" },
  { key: "sessionSecret", label: "SESSION_SECRET" },
  { key: "workerKey", label: "WHATSAPP_WORKER_KEY" },
  { key: "cronSecret", label: "CRON_SECRET" },
  { key: "superadminLogin", label: "SUPERADMIN_LOGIN" },
  { key: "superadminPassword", label: "SUPERADMIN_PASSWORD" },
];

const hex = (bytes: number) => randomBytes(bytes).toString("hex");

export function generateSecrets(): ClusterSecrets & { platformKey: string } {
  return {
    databaseUrl: "",
    directUrl: "",
    sessionSecret: hex(32),
    workerKey: hex(24),
    cronSecret: hex(24),
    superadminLogin: "admin",
    superadminPassword: newPassword(16),
    platformKey: hex(32),
  };
}

export const sealSecrets = (s: ClusterSecrets) => encrypt(JSON.stringify(s));
export function openSecrets(stored: string | null): ClusterSecrets | null {
  if (!stored) return null;
  try {
    return JSON.parse(decrypt(stored));
  } catch {
    return null;
  }
}

// Ready to paste into Vercel's and Render's "Add environment variables" boxes.
export function vercelEnv(s: ClusterSecrets, platformKey: string, senderUrl: string | null): string {
  return [
    `DATABASE_URL=${s.databaseUrl}`,
    `DIRECT_URL=${s.directUrl}`,
    `SESSION_SECRET=${s.sessionSecret}`,
    `SUPERADMIN_LOGIN=${s.superadminLogin}`,
    `SUPERADMIN_PASSWORD=${s.superadminPassword}`,
    `WHATSAPP_WORKER_KEY=${s.workerKey}`,
    `CRON_SECRET=${s.cronSecret}`,
    `WHATSAPP_WORKER_URL=${senderUrl ?? ""}`,
    `PLATFORM_API_KEY=${platformKey}`,
    `ALLOW_SIGNUP=false`,
  ].join("\n");
}

export function renderEnv(s: ClusterSecrets, appUrl: string): string {
  return [
    `DATABASE_URL=${s.directUrl}`,
    `WHATSAPP_WORKER_KEY=${s.workerKey}`,
    `CRON_SECRET=${s.cronSecret}`,
    `APP_URL=${appUrl}`,
  ].join("\n");
}
