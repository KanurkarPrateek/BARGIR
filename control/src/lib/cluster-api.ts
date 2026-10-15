// Talks to a cluster's /api/platform/* (see src/app/api/platform in the gym app).
import { decrypt } from "./crypto";

export interface ClusterRef {
  appUrl: string;
  apiKeyEncrypted: string;
}

export interface RemoteGym {
  id: string;
  name: string;
  active: boolean;
  setupDone: boolean;
  createdAt: string;
  ownerName: string | null;
  ownerPhone: string | null;
  members: number;
  activeMembers: number;
  lastActivity: string | null;
  machines: number;
  whatsappLinked: boolean;
}

export interface ClusterStatus {
  ok: boolean;
  database: boolean;
  sender: "ok" | "unreachable" | "not configured";
  gyms: number;
  version: string;
  signupOpen: boolean;
  responseMs: number;
}

export class ClusterError extends Error {}

async function request<T>(cluster: ClusterRef, path: string, init: RequestInit = {}, apiKey?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${cluster.appUrl.replace(/\/$/, "")}/api/platform${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey ?? decrypt(cluster.apiKeyEncrypted)}` },
    });
  } catch {
    throw new ClusterError(`Cannot reach ${cluster.appUrl}`);
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) throw new ClusterError("The cluster refused the API key (check PLATFORM_API_KEY on its Vercel project)");
  if (res.status === 404 && !body.error) throw new ClusterError("This cluster does not have the platform API yet; redeploy it with the latest code");
  if (!res.ok) throw new ClusterError(body.error ?? `Cluster answered ${res.status}`);
  return body as T;
}

export const clusterStatus = (c: ClusterRef, apiKey?: string) => request<ClusterStatus>(c, "/status", {}, apiKey);
export const clusterGyms = async (c: ClusterRef) => (await request<{ gyms: RemoteGym[] }>(c, "/gyms")).gyms;
export const createRemoteGym = (c: ClusterRef, gym: { name: string; ownerName: string; ownerPhone: string; password: string }) =>
  request<{ id: string; name: string }>(c, "/gyms", { method: "POST", body: JSON.stringify(gym) });
export const updateRemoteGym = (c: ClusterRef, id: string, change: { active?: boolean; ownerPassword?: string }) =>
  request<{ ok: true }>(c, `/gyms/${id}`, { method: "PATCH", body: JSON.stringify(change) });
