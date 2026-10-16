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
// A message taken for sending this long ago without being marked sent is
// failed, never sent again, since it may already have reached the member.
const STUCK_AFTER_MINUTES = 10;
// Reminders and offers go out only between these hours, India time.
const DAY_STARTS_AT = 9;
const DAY_ENDS_AT = 21;
// Workflows that answer something the member just did go out at any hour.
const IMMEDIATE_TRIGGERS = ["enquiry_created", "sale_created", "payment_received"];

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

// A failed database write or a WhatsApp hiccup must not take every gym down.
process.on("unhandledRejection", (reason) => {
  log.error({ err: reason?.message ?? String(reason) }, "unhandled rejection");
});
process.on("uncaughtException", (error) => {
  // The process is in an unknown state; log it and let the host restart us.
  log.fatal({ err: error.message, stack: error.stack }, "uncaught exception");
  process.exit(1);
});

// India has no daylight saving, so its hour is UTC + 5:30 on any server.
const indiaHour = () => new Date(Date.now() + 330 * 60 * 1000).getUTCHours();
const isQuietHours = () => indiaHour() < DAY_STARTS_AT || indiaHour() >= DAY_ENDS_AT;

// Only the app's own address gets our key along with the request.
const APP_ORIGIN = (() => {
  try {
    return APP_URL ? new URL(APP_URL).origin : "";
  } catch {
    return "";
  }
})();

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
    sock.ev.on("creds.update", () => void saveCredsWithRetry(gymId, saveCreds));

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      try {
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
          } else if (code === DisconnectReason.connectionReplaced) {
            // Another copy of this service (a deploy in progress) took over the
            // number. Reconnecting would make the two keep kicking each other off.
            log.warn({ gymId }, "connection taken over by another sender, not reconnecting");
          } else if (state.creds.registered || state.creds.me) {
            // A linked number dropped its connection; get it back.
            log.info({ gymId, code }, "connection closed, reconnecting");
            setTimeout(() => startSession(gymId).catch(() => {}), 3000);
          }
          // Otherwise nobody scanned the QR in time. It restarts when the
          // gym next opens its WhatsApp page.
        }
      } catch (error) {
        log.error({ gymId, err: error.message }, "connection update failed");
      }
    });
  } catch (error) {
    sessions.delete(gymId);
    log.error({ gymId, err: error.message }, "could not start WhatsApp session");
    throw error;
  }
  return session;
}

// Losing a login save means relinking the number, so a database blip gets a
// few more tries before giving up.
async function saveCredsWithRetry(gymId, saveCreds) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await saveCreds();
      return;
    } catch (error) {
      log.warn({ gymId, attempt, err: error.message }, "could not save WhatsApp login");
      if (attempt < 4) await sleep(2000 * attempt);
    }
  }
  log.error({ gymId }, "gave up saving WhatsApp login");
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
  db.query(`UPDATE "WhatsappMessage" SET status = 'failed', error = $2, "sentAt" = NULL WHERE id = $1`, [
    id,
    String(error).slice(0, 300),
  ]);

// The invoice PDF from the app, which hands it over only with our key. Tried
// twice (a sleeping app can be slow to wake); without it the message fails,
// so a member never gets the text without their invoice.
async function fetchDocument(url) {
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {
    // Not a web address; the fetch below fails and so does the message.
  }
  // Our key never goes to any other address; without it the app refuses
  // and the message fails, which is the safe outcome.
  const ours = APP_ORIGIN !== "" && origin === APP_ORIGIN;
  if (!ours) log.warn({ url, appUrl: APP_URL || null }, "invoice address is not the app's; fetching without the key");
  const headers = ours ? { "x-api-key": API_KEY } : {};
  let problem;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1];
      return { buffer: Buffer.from(await res.arrayBuffer()), fileName: name ?? "Invoice.pdf" };
    } catch (error) {
      problem = error;
      await sleep(3000);
    }
  }
  throw new Error(`Could not get the invoice PDF (${problem.message}); press Retry failed`);
}

// The digits of a WhatsApp id ("9198…:12@s.whatsapp.net" -> "9198…").
const idDigits = (id) => String(id ?? "").split(/[:@]/)[0];

// Groups this gym's number is in, and whether it is an admin of each.
async function listGroups(session) {
  const me = [idDigits(session.sock.user?.id), idDigits(session.sock.user?.lid)].filter(Boolean);
  const groups = await session.sock.groupFetchAllParticipating();
  return Object.values(groups)
    .map((g) => ({
      id: g.id,
      name: g.subject,
      size: g.participants.length,
      isAdmin: g.participants.some((p) => p.admin && [p.id, p.jid, p.phoneNumber, p.lid].some((x) => me.includes(idDigits(x)))),
    }))
    .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name));
}

// Adds the person to the gym's group. If WhatsApp will not let them be added
// (their privacy settings, or they left recently) they get the invite link.
async function addToGroup(session, message, jid) {
  let result;
  try {
    [result] = await session.sock.groupParticipantsUpdate(message.groupId, [jid], "add");
  } catch (error) {
    if (/not-authorized|forbidden|403/i.test(error.message)) {
      return markFailed(message.id, "The gym's WhatsApp number is not an admin of the group");
    }
    if (/item-not-found|404/i.test(error.message)) {
      return markFailed(message.id, "The gym's WhatsApp group no longer exists; choose it again");
    }
    throw error;
  }
  const status = String(result?.status ?? "");
  let note;
  if (status === "200") note = "➕ Added to the gym's WhatsApp group";
  else if (status === "409") note = "Already in the gym's WhatsApp group";
  else {
    const code = await session.sock.groupInviteCode(message.groupId);
    note = message.body.replaceAll("{group_link}", `https://chat.whatsapp.com/${code}`);
    await session.sock.sendMessage(jid, { text: note });
  }
  await db.query(
    `UPDATE "WhatsappMessage" SET status = 'sent', "sentAt" = now(), error = NULL, body = $2 WHERE id = $1`,
    [message.id, note]
  );
}

async function sendOne(session, message) {
  const jid = toJid(message.phone);
  const [found] = await session.sock.onWhatsApp(jid);
  if (!found?.exists) return markFailed(message.id, "This number is not on WhatsApp");
  if (message.groupId) return addToGroup(session, message, found.jid);
  const pdf = message.document ? await fetchDocument(message.document) : null;
  await session.sock.sendMessage(
    found.jid,
    // The invoice goes as a PDF with the message as its caption.
    pdf ? { document: pdf.buffer, mimetype: "application/pdf", fileName: pdf.fileName, caption: message.body } : { text: message.body }
  );
  await db.query(
    `UPDATE "WhatsappMessage" SET status = 'sent', "sentAt" = now(), error = NULL WHERE id = $1`,
    [message.id]
  );
}

let draining = false;
// Gyms whose queue is being worked through right now.
const drainingGyms = new Set();

// Clears out what cannot be sent any more, then lets every connected gym
// work through its own queue, so one gym's slow invoice does not hold up the rest.
async function drainQueue() {
  if (draining) return;
  draining = true;
  try {
    await db.query(
      `UPDATE "WhatsappMessage" SET status = 'failed',
              error = 'Not sent within ${STALE_AFTER_HOURS} hours (WhatsApp was not connected)'
       WHERE status = 'pending' AND "createdAt" < now() - interval '${STALE_AFTER_HOURS} hours'`
    );
    // The sender stopped part way through these, so they may have gone out.
    await db.query(
      `UPDATE "WhatsappMessage" SET status = 'failed', "sentAt" = NULL,
              error = 'Not sure it was delivered (the sender restarted); check before retrying'
       WHERE status = 'sending'
         AND COALESCE("sentAt", "createdAt") < now() - interval '${STUCK_AFTER_MINUTES} minutes'`
    );
  } catch (error) {
    log.error({ err: error.message }, "queue clean-up failed");
  } finally {
    draining = false;
  }
  for (const [gymId, session] of sessions) {
    if (session.state === "connected") void drainGym(gymId);
  }
}

// Takes this gym's oldest message that may go out now and marks it
// 'sending' in one step, so no other copy of the service can take it too.
// Outside the day only immediate messages (one-off sends from the desk,
// group adds, replies to an enquiry, sale or payment) are taken; reminders
// and offers wait for the morning without holding those up.
async function claimNext(gymId) {
  const { rows } = await db.query(
    `UPDATE "WhatsappMessage" SET status = 'sending', "sentAt" = now()
     WHERE status = 'pending' AND id = (
       SELECT m.id FROM "WhatsappMessage" m
       JOIN "Gym" g ON g.id = m.gym_id AND g.active
       LEFT JOIN "WhatsappWorkflow" w ON w.id = m.workflow_id
       WHERE m.status = 'pending' AND m.gym_id = $1
         AND (NOT $2::boolean
              OR m."groupId" IS NOT NULL
              OR (m.workflow_id IS NULL AND m.campaign_id IS NULL)
              OR w.trigger::text = ANY($3))
       ORDER BY m."createdAt" ASC
       LIMIT 1
       FOR UPDATE OF m SKIP LOCKED)
     RETURNING id, gym_id, phone, body, document, "groupId"`,
    [gymId, isQuietHours(), IMMEDIATE_TRIGGERS]
  );
  return rows[0];
}

async function drainGym(gymId) {
  if (drainingGyms.has(gymId)) return;
  drainingGyms.add(gymId);
  try {
    while (true) {
      const session = sessions.get(gymId);
      if (session?.state !== "connected") return;
      // Each gym's number keeps its own gap between messages.
      const wait = session.lastSentAt + MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS) - Date.now();
      if (wait > 0) await sleep(wait);
      if (sessions.get(gymId) !== session || session.state !== "connected") return;

      const message = await claimNext(gymId);
      if (!message) return;
      try {
        await sendOne(session, message);
      } catch (error) {
        if (sessions.get(gymId)?.state !== "connected") {
          // A dropped connection puts the message back to wait for it.
          await db.query(
            `UPDATE "WhatsappMessage" SET status = 'pending', "sentAt" = NULL WHERE id = $1 AND status = 'sending'`,
            [message.id]
          );
          return;
        }
        // Anything else is a problem with this message, so it is marked and skipped.
        await markFailed(message.id, error.message);
      }
      session.lastSentAt = Date.now();
    }
  } catch (error) {
    log.error({ gymId, err: error.message }, "queue run failed");
  } finally {
    drainingGyms.delete(gymId);
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
      const groupsMatch = /^\/sessions\/([\w-]+)\/groups$/.exec(url.pathname);
      if (groupsMatch && req.method === "GET") {
        const session = sessions.get(groupsMatch[1]);
        if (session?.state !== "connected") return json(res, 409, { error: "Link the gym's WhatsApp number first" });
        return json(res, 200, { groups: await listGroups(session) });
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
