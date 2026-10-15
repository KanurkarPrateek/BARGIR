#!/usr/bin/env node
// Pretends to be an eSSL / ZKTeco / BioMax "Push" attendance machine, so the
// biometric integration can be tested without real hardware. It speaks the
// same ADMS protocol the machine does: handshake, user list, stored punch
// history, live punches, heartbeats, and replies to server commands.
//
//   node simulator.mjs --server http://localhost:3000 --serial BIOMAX-SIM-001
//
// While it runs, type a user ID and press Enter to punch as that person.

import { createInterface } from "node:readline";

const DEFAULT_USERS = [
  [1, "Rahul Sharma"], [2, "Priya Patil"], [3, "Amit Deshmukh"], [4, "Sneha Joshi"],
  [5, "Vikram Singh"], [6, "Anjali Kulkarni"], [7, "Rohit Verma"], [8, "Neha Gupta"],
].map(([pin, name]) => ({ pin: String(pin), name }));

function parseArgs(argv) {
  const args = { server: "http://localhost:3000", serial: "BIOMAX-SIM-001", users: 8, historyDays: 2, live: 0, once: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--once") args.once = true;
    else if (key === "--help" || key === "-h") args.help = true;
    else if (key.startsWith("--")) {
      const name = key.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());
      const value = argv[++i];
      args[name] = /^\d+$/.test(value) ? Number(value) : value;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Biometric machine simulator

  --server <url>       Where the gym software runs (default http://localhost:3000)
                       Use https://... to test the HTTPS path.
  --serial <text>      Serial number the machine reports (default BIOMAX-SIM-001)
  --users <n>          How many enrolled people to start with, 0-8 (default 8)
  --history-days <n>   Days of stored punches to send on connect (default 2, 0 for none)
  --live <seconds>     Also punch as a random person every N seconds (default off)
  --once               Connect, send everything, then exit instead of staying on
  --heartbeat <s>      Check in every s seconds instead of what the server asks (for quick tests)

While running: type a user ID + Enter to punch, "users" to list people, "q" to quit.`);
  process.exit(0);
}

// People enrolled on this pretend machine. Server commands add and remove them.
const users = DEFAULT_USERS.slice(0, Math.max(0, Math.min(args.users, DEFAULT_USERS.length)));
const base = String(args.server).replace(/\/$/, "");
const log = (...parts) => console.log(new Date().toLocaleTimeString("en-GB"), ...parts);

// Settings the server hands back in the handshake; a real machine obeys them.
const settings = { delay: 10, errorDelay: 30 };
// Punches not yet accepted by the server. A real machine keeps them in its
// own memory and resends until the server says OK.
let pending = [];
let nextStamp = 1;

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// One attendance log line exactly as the machine sends it:
// user id, time, in/out state, verify method (1 = fingerprint), work code.
const punchLine = (pin, when) => `${pin}\t${stamp(when)}\t0\t1\t0\t0\t0`;

async function call(method, path, body) {
  const url = `${base}/iclock/${path}`;
  try {
    const res = await fetch(url, {
      method,
      body,
      headers: body ? { "Content-Type": "text/plain" } : undefined,
      redirect: "manual", // a real machine does not follow redirects
      signal: AbortSignal.timeout(15000),
    });
    return { status: res.status, text: (await res.text()).trim(), location: res.headers.get("location") };
  } catch (error) {
    return { status: 0, text: String(error.cause?.code ?? error.message) };
  }
}

async function handshake() {
  const res = await call("GET", `cdata?SN=${args.serial}&options=all&pushver=2.4.1&language=69`);
  if (res.status >= 300 && res.status < 400) {
    log(`✗ server answered ${res.status} redirect to ${res.location} — a real machine would stop here (HTTP vs HTTPS mismatch)`);
    return false;
  }
  if (res.status !== 200 || !res.text.startsWith("GET OPTION FROM")) {
    log(`✗ handshake failed (${res.status || "no connection"}): ${res.text.slice(0, 80)}`);
    return false;
  }
  for (const line of res.text.split("\n")) {
    const [key, value] = line.split("=");
    if (key === "Delay") settings.delay = Number(value) || settings.delay;
    if (key === "ErrorDelay") settings.errorDelay = Number(value) || settings.errorDelay;
    if (key === "TimeZone") settings.timeZone = value;
  }
  if (args.heartbeat) settings.delay = args.heartbeat;
  log(`✓ connected as ${args.serial} (heartbeat every ${settings.delay}s, server timezone setting ${settings.timeZone ?? "none"})`);
  return true;
}

const userLines = () =>
  users.map((u) => `USER PIN=${u.pin}\tName=${u.name}\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000100000000`).join("\n") + "\n";

async function sendUsers(table = "OPERLOG") {
  const res = await call("POST", `cdata?SN=${args.serial}&table=${table}&Stamp=9999`, userLines());
  log(res.status === 200 ? `✓ sent ${users.length} enrolled people` : `… user list not accepted yet (${res.status}: ${res.text.slice(0, 60)})`);
  return res.status === 200;
}

async function flushPunches() {
  if (pending.length === 0) return true;
  const batch = pending.slice();
  const res = await call("POST", `cdata?SN=${args.serial}&table=ATTLOG&Stamp=${nextStamp + batch.length}`, batch.join("\n") + "\n");
  if (res.status === 200 && res.text.startsWith("OK")) {
    nextStamp += batch.length;
    pending = pending.slice(batch.length);
    log(`✓ ${batch.length} punch${batch.length === 1 ? "" : "es"} accepted (${res.text})`);
    return true;
  }
  log(`… ${batch.length} punch${batch.length === 1 ? "" : "es"} held on the machine, server said ${res.status || "nothing"}: ${res.text.slice(0, 60)}`);
  return false;
}

function addHistory(days) {
  for (let back = days; back >= 1; back--) {
    for (const user of users) {
      // Not everyone comes every day.
      if (Math.random() < 0.25) continue;
      const when = new Date();
      when.setDate(when.getDate() - back);
      when.setHours(6 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
      pending.push(punchLine(user.pin, when));
      // Some people punch again on the way out; only the first should count.
      if (Math.random() < 0.3) {
        const out = new Date(when.getTime() + 75 * 60000);
        pending.push(punchLine(user.pin, out));
      }
    }
  }
}

function punch(pin) {
  const user = users.find((u) => u.pin === String(pin));
  // A real machine just shows "not registered" and records nothing.
  if (!user) return log(`✗ ID ${pin} is not enrolled on this machine (blocked or deleted) — no punch recorded`);
  pending.push(punchLine(user.pin, new Date()));
  log(`☝ ${user.name} (ID ${user.pin}) punched`);
  flushPunches();
}

// The server can leave commands for the machine in its heartbeat reply,
// e.g. "C:12:DATA QUERY USERINFO" to ask for everyone enrolled.
async function heartbeat() {
  const res = await call("GET", `getrequest?SN=${args.serial}`);
  if (res.status !== 200) return log(`… heartbeat failed (${res.status || "no connection"})`);
  for (const line of res.text.split("\n")) {
    const match = /^C:(\w+):(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, id, command] = match;
    log(`⇐ server command ${id}: ${command}`);
    let result = 0;
    const field = (name) => new RegExp(`(?:^|\\t| )${name}=([^\\t]*)`).exec(command)?.[1];
    if (/^DATA QUERY USERINFO/i.test(command)) await sendUsers("USERINFO");
    else if (/^DATA UPDATE USERINFO/i.test(command)) {
      const pin = field("PIN"), name = field("Name") ?? "";
      const existing = users.find((u) => u.pin === pin);
      if (existing) existing.name = name; else users.push({ pin, name });
      log(`✓ machine now has ID ${pin} (${name}); enroll the finger on the machine`);
    } else if (/^DATA DELETE USERINFO/i.test(command)) {
      const pin = field("PIN");
      const index = users.findIndex((u) => u.pin === pin);
      if (index >= 0) users.splice(index, 1);
      log(`✓ removed ID ${pin} from the machine`);
    } else if (/^(CHECK|INFO|LOG)\b/i.test(command)) await flushPunches();
    else result = -1; // unsupported, as a real machine reports
    await call("POST", `devicecmd?SN=${args.serial}`, `ID=${id}&Return=${result}&CMD=${command.split(" ")[0]}\n`);
  }
}

// ---- run ----
log(`simulated machine ${args.serial} → ${base}`);
if (!(await handshake())) {
  if (args.once) process.exit(1);
  log(`retrying every ${settings.errorDelay}s`);
}
addHistory(args.historyDays);
if (pending.length) log(`${pending.length} stored punches from the last ${args.historyDays} day(s) to upload`);
// Like the punches, the user list is resent until the server takes it.
let usersSent = await sendUsers();
const accepted = await flushPunches();

if (args.once) process.exit(accepted ? 0 : 2);

setInterval(async () => {
  if (!usersSent) usersSent = await sendUsers();
  if (pending.length && !(await flushPunches())) return;
  await heartbeat();
}, settings.delay * 1000);
setInterval(async () => {
  // Re-handshake like a machine that has been waiting on an error.
  if (pending.length || !usersSent) await handshake();
}, settings.errorDelay * 1000);
if (args.live) {
  setInterval(() => punch(users[Math.floor(Math.random() * users.length)].pin), args.live * 1000);
}

log(`running. Type a user ID (1-${users.length}) + Enter to punch, "users" to list, "q" to quit.`);
createInterface({ input: process.stdin }).on("line", (line) => {
  const input = line.trim();
  if (input === "q") process.exit(0);
  if (input === "users") return users.length ? users.forEach((u) => console.log(`  ${u.pin}  ${u.name}`)) : console.log("  (nobody enrolled)");
  if (input) punch(input);
});
