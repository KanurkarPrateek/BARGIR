// Talks to the WhatsApp sender service (worker/), which keeps each gym's
// number linked and delivers the queued messages. The app itself never sends:
// it only queues rows and asks the sender about connection state.

const WORKER_URL = (process.env.WHATSAPP_WORKER_URL ?? "http://localhost:3200").replace(/\/$/, "");
const headers = { "x-api-key": process.env.WHATSAPP_WORKER_KEY ?? "" };

export type ConnectionState = "connected" | "qr" | "starting" | "offline";

export interface Connection {
  state: ConnectionState;
  // PNG data URL, only when state is "qr".
  qr?: string;
  // The linked WhatsApp number, when connected.
  number?: string;
  detail?: string;
}

export async function getConnection(gymId: string): Promise<Connection> {
  try {
    const res = await fetch(`${WORKER_URL}/sessions/${gymId}`, {
      headers,
      cache: "no-store",
      // A sleeping free-tier sender takes a while to wake.
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { state: "offline", detail: `Sender replied ${res.status}` };
    return (await res.json()) as Connection;
  } catch {
    return { state: "offline", detail: "WhatsApp sender is not reachable" };
  }
}

export async function disconnect(gymId: string): Promise<void> {
  await fetch(`${WORKER_URL}/sessions/${gymId}/logout`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(20000),
  });
}

export interface WhatsappGroup {
  id: string;
  name: string;
  size: number;
  // Only groups where the gym's number is an admin can take new members.
  isAdmin: boolean;
}

// Groups the gym's linked number is in.
export async function getGroups(gymId: string): Promise<WhatsappGroup[]> {
  const res = await fetch(`${WORKER_URL}/sessions/${gymId}/groups`, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  }).catch(() => null);
  if (!res) throw new Error("WhatsApp sender is not reachable");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Sender replied ${res.status}`);
  return body.groups;
}

// Tells the sender there is something new in the queue, which also wakes it
// if it was asleep. Best effort: the sender checks the queue by itself too.
export async function nudgeSender(): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/wake`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Still waking up or briefly down; the queued rows wait for it.
  }
}
