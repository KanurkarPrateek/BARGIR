// WhatsApp sender for the gym software.
//
// The web app only writes rows into the WhatsappMessage table. This service
// keeps one WhatsApp connection per gym (linked by scanning a QR, like
// WhatsApp Web), delivers those rows one at a time, and every few minutes
// asks the app to queue whatever automatic messages have become due.
//
// It needs no disk: each gym's WhatsApp login is stored in the database, so
// it survives restarts and runs on a free hosting tier.

import {
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  makeWASocket,
  proto,
} from "@whiskeysockets/baileys";
import http from "node:http";
import pg from "pg";
import pino from "pino";
import QRCode from "qrcode";

const PORT = Number(process.env.PORT ?? 3200);
const API_KEY = process.env.WHATSAPP_WORKER_KEY ?? "";
const APP_URL = (process.env.APP_URL ?? "").replace(/\/$/, "");
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE ?? "91";
// Set by Render; pinging our own public address keeps a free instance awake.
const SELF_URL = process.env.RENDER_EXTERNAL_URL ?? "";

const TICK_EVERY_MS = 5 * 60 * 1000;
const KEEP_AWAKE_EVERY_MS = 10 * 60 * 1000;
const QUEUE_POLL_MS = 15 * 1000;
// Pause between messages from one number so a broadcast does not look like spam.
const MIN_GAP_MS = 3000;
const MAX_GAP_MS = 6000;
// Messages that could not go out for this long are dropped, not sent late.
const STALE_AFTER_HOURS = 24;

if (!API_KEY) throw new Error("WHATSAPP_WORKER_KEY is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });
const isLocalDb = /localhost|127\.0\.0\.1|host\.docker\.internal/.test(process.env.DATABASE_URL);
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- WhatsApp login stored in the database ----------

async function dbAuthState(gymId) {
  const read = async (key) => {
    const { rows } = await db.query(
      'SELECT value FROM "WhatsappAuth" WHERE gym_id = $1 AND key = $2',
      [gymId, key]
    );
    return rows[0] ? JSON.parse(rows[0].value, BufferJSON.reviver) : null;
  };
  const write = (key, value) =>
    db.query(
      `INSERT INTO "WhatsappAuth" (gym_id, key, value, "updatedAt") VALUES ($1, $2, $3, now())
       ON CONFLICT (gym_id, key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()`,
      [gymId, key, JSON.stringify(value, BufferJSON.replacer)]
    );
  const remove = (key) =>
    db.query('DELETE FROM "WhatsappAuth" WHERE gym_id = $1 AND key = $2', [gymId, key]);

  const creds = (await read("creds")) ?? initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const found = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await read(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              found[id] = value;
            })
          );
          return found;
        },
        set: async (data) => {
          const writes = [];
          for (const type in data) {
            for (const id in data[type]) {
              const value = data[type][id];
              writes.push(value ? write(`${type}-${id}`, value) : remove(`${type}-${id}`));
            }
          }
          await Promise.all(writes);
        },
      },
    },
    saveCreds: () => write("creds", creds),
  };
}

const clearAuth = (gymId) => db.query('DELETE FROM "WhatsappAuth" WHERE gym_id = $1', [gymId]);

// ---------- one connection per gym ----------

// gymId -> { sock, state: "starting" | "qr" | "connected", qr, number, lastSentAt }
const sessions = new Map();

async function startSession(gymId) {
  if (sessions.has(gymId)) return sessions.get(gymId);
  const session = { sock: null, state: "starting", qr: null, number: null, lastSentAt: 0 };
  sessions.set(gymId, session);

  try {
    const { state, saveCreds } = await dbAuthState(gymId);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      browser: ["Gym Manager", "Chrome", "1.0"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    session.sock = sock;
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        session.state = "qr";
        session.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      }
      if (connection === "open") {
        session.state = "connected";
        session.qr = null;
        session.number = sock.user?.id?.split(/[:@]/)[0] ?? null;
        log.info({ gymId, number: session.number }, "WhatsApp linked");
        void drainQueue();
      }
      if (connection === "close") {
        // A newer connection may already have replaced this one.
        if (sessions.get(gymId) !== session) return;
        sessions.delete(gymId);
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          // Unlinked from the phone: forget the login so a fresh QR is shown.
          await clearAuth(gymId);
          log.info({ gymId }, "WhatsApp unlinked from the phone");
        } else if (state.creds.registered || state.creds.me) {
          // A linked number dropped its connection; get it back.
          log.info({ gymId, code }, "connection closed, reconnecting");
          setTimeout(() => startSession(gymId).catch(() => {}), 3000);
        }
        // Otherwise nobody scanned the QR in time. It restarts when the
        // gym next opens its WhatsApp page.
      }
    });
  } catch (error) {
    sessions.delete(gymId);
    log.error({ gymId, err: error.message }, "could not start WhatsApp session");
    throw error;
  }
  return session;
}

// After a restart, reconnect every gym that had already linked a number.
async function restoreLinkedSessions() {
  const { rows } = await db.query(
    `SELECT a.gym_id FROM "WhatsappAuth" a JOIN "Gym" g ON g.id = a.gym_id
     WHERE a.key = 'creds' AND g.active`
  );
  for (const { gym_id } of rows) {
    startSession(gym_id).catch(() => {});
    await sleep(1500);
  }
  log.info({ gyms: rows.length }, "restored linked sessions");
}

async function logout(gymId) {
  const session = sessions.get(gymId);
  sessions.delete(gymId);
  try {
    await session?.sock?.logout();
  } catch {
    // Already disconnected; clearing the stored login below is what matters.
  }
  await clearAuth(gymId);
}

// ---------- delivering the queue ----------

// 10 digit local numbers get the default country code.
function toJid(phone) {
  const digits = String(phone).replace(/\D/g, "");
  return `${digits.length === 10 ? COUNTRY_CODE + digits : digits}@s.whatsapp.net`;
}

const markFailed = (id, error) =>
  db.query(`UPDATE "WhatsappMessage" SET status = 'failed', error = $2 WHERE id = $1`, [
    id,
    String(error).slice(0, 300),
  ]);

async function sendOne(session, message) {
  const jid = toJid(message.phone);
  const [found] = await session.sock.onWhatsApp(jid);
  if (!found?.exists) return markFailed(message.id, "This number is not on WhatsApp");
  await session.sock.sendMessage(found.jid, { text: message.body });
  await db.query(
    `UPDATE "WhatsappMessage" SET status = 'sent', "sentAt" = now(), error = NULL WHERE id = $1`,
    [message.id]
  );
}

let draining = false;

async function drainQueue() {
  if (draining) return;
  draining = true;
  try {
    await db.query(
      `UPDATE "WhatsappMessage" SET status = 'failed',
              error = 'Not sent within ${STALE_AFTER_HOURS} hours (WhatsApp was not connected)'
       WHERE status = 'pending' AND "createdAt" < now() - interval '${STALE_AFTER_HOURS} hours'`
    );

    while (true) {
      const connected = [...sessions.entries()].filter(([, s]) => s.state === "connected");
      if (connected.length === 0) return;

      // The oldest waiting message of each connected gym.
      const { rows } = await db.query(
        `SELECT DISTINCT ON (gym_id) id, gym_id, phone, body FROM "WhatsappMessage"
         WHERE status = 'pending' AND gym_id = ANY($1)
         ORDER BY gym_id, "createdAt" ASC`,
        [connected.map(([gymId]) => gymId)]
      );
      if (rows.length === 0) return;

      for (const message of rows) {
        const session = sessions.get(message.gym_id);
        if (session?.state !== "connected") continue;
        // Each gym's number keeps its own gap between messages.
        const wait = session.lastSentAt + MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS) - Date.now();
        if (wait > 0) await sleep(wait);
        try {
          await sendOne(session, message);
        } catch (error) {
          // A dropped connection leaves the message waiting; anything else
          // is a problem with this message, so it is marked and skipped.
          if (sessions.get(message.gym_id)?.state !== "connected") continue;
          await markFailed(message.id, error.message);
        }
        session.lastSentAt = Date.now();
      }
    }
  } catch (error) {
    log.error({ err: error.message }, "queue run failed");
  } finally {
    draining = false;
  }
}

// ---------- timers ----------

// Asks the app to queue automatic messages (expiry reminders, follow-ups,
// birthdays) that have become due for any gym.
async function tick() {
  if (!APP_URL || !CRON_SECRET) return;
  try {
    const res = await fetch(`${APP_URL}/api/cron/tick`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(60000),
    });
    log.info({ status: res.status, body: (await res.text()).slice(0, 120) }, "tick");
  } catch (error) {
    log.warn({ err: error.message }, "tick failed");
  }
  void drainQueue();
}

// ---------- HTTP API used by the app ----------

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/health") return json(res, 200, { ok: true, sessions: sessions.size });
    if (req.headers["x-api-key"] !== API_KEY) return json(res, 401, { error: "Unauthorized" });

    try {
      const match = /^\/sessions\/([\w-]+)(\/logout)?$/.exec(url.pathname);
      if (match && req.method === "GET" && !match[2]) {
        // Opening the WhatsApp page starts linking, so a QR appears.
        const session = await startSession(match[1]);
        return json(res, 200, {
          state: session.state,
          qr: session.qr ?? undefined,
          number: session.number ?? undefined,
        });
      }
      if (match && req.method === "POST" && match[2]) {
        await logout(match[1]);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/wake" && req.method === "POST") {
        void drainQueue();
        return json(res, 200, { ok: true });
      }
      json(res, 404, { error: "Not found" });
    } catch (error) {
      json(res, 500, { error: error.message });
    }
  })
  .listen(PORT, () => log.info({ port: PORT }, "WhatsApp sender listening"));

await restoreLinkedSessions();
setInterval(drainQueue, QUEUE_POLL_MS);
setInterval(tick, TICK_EVERY_MS);
setTimeout(tick, 20 * 1000);
if (SELF_URL) {
  setInterval(() => fetch(`${SELF_URL}/health`).catch(() => {}), KEEP_AWAKE_EVERY_MS);
}
