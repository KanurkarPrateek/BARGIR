// Shared helpers for the browser tests. Run them with `npm run test:e2e`,
// which starts a separate copy of the app on a throwaway database (see
// tests/run-e2e.sh) so real gyms and real WhatsApp numbers are never touched.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

export const BASE = process.env.BASE ?? "http://localhost:3100";
export const ADMIN_LOGIN = process.env.SUPERADMIN_LOGIN ?? "admin";
export const ADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;
export const SIMULATOR = new URL("../../tools/biometric-simulator/simulator.mjs", import.meta.url).pathname;

export async function startBrowser(name) {
  mkdirSync("tests/e2e/screenshots", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: !process.env.HEADED });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("dialog", (dialog) => dialog.accept(dialog.type() === "prompt" ? "Test reason" : undefined));
  const results = [];
  let n = 0;

  const step = async (title, fn) => {
    n++;
    try {
      await fn();
      results.push({ ok: true, title });
      console.log(`  ✓ ${title}`);
    } catch (error) {
      results.push({ ok: false, title });
      console.log(`  ✗ ${title}\n      ${String(error.message).split("\n")[0].slice(0, 220)}`);
      await page.screenshot({ path: `tests/e2e/screenshots/${name}-${n}.png`, fullPage: true }).catch(() => {});
    }
  };
  const finish = async () => {
    await browser.close();
    const failed = results.filter((r) => !r.ok).length;
    console.log(`  ${results.length - failed} passed, ${failed} failed\n`);
    return failed;
  };
  return { browser, context, page, step, finish };
}

export const toast = (page, text) => page.getByText(text, { exact: false }).first().waitFor({ timeout: 10000 });

export async function signIn(page, login, password) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/signin`);
  await page.locator("#login").fill(login);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function pickDate(page, day = "15", index = 0) {
  await page.getByRole("button", { name: /Pick a date|\d{4}$/ }).nth(index).click();
  await page.getByRole("gridcell", { name: day, exact: true }).first().click();
  await page.keyboard.press("Escape");
}

// Opens one of the app's searchable pickers and chooses an entry. Retries,
// because the list can re-render while it is opening.
export async function choose(page, currentText, optionText) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.getByRole("combobox").filter({ hasText: currentText }).first().click();
      const popup = page.locator("[data-radix-popper-content-wrapper]").last();
      await popup.waitFor({ timeout: 4000 });
      const button = popup.getByRole("button", { name: optionText }).first();
      if (await button.count()) await button.click({ timeout: 4000 });
      else await popup.getByRole("option", { name: optionText }).first().click({ timeout: 4000 });
      return;
    } catch (error) {
      lastError = error;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  }
  throw lastError;
}

// Runs the attendance-machine simulator once and returns what it printed.
export function simulateOnce(serial, extra = []) {
  return new Promise((resolve) => {
    const child = spawn("node", [SIMULATOR, "--server", BASE, "--serial", serial, "--once", ...extra]);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", () => resolve(out));
  });
}

// Starts a long-running simulated machine; type user IDs into it to punch.
export function startMachine(serial, extra = []) {
  const child = spawn("node", [SIMULATOR, "--server", BASE, "--serial", serial, "--heartbeat", "2", ...extra]);
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  return {
    punch: (pin) => child.stdin.write(`${pin}\n`),
    output: () => out,
    waitFor: async (pattern, ms = 20000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (pattern.test(out)) return;
        await new Promise((r) => setTimeout(r, 300));
      }
      throw new Error(`machine never printed ${pattern}; last output:\n${out.split("\n").slice(-6).join("\n")}`);
    },
    stop: () => child.kill(),
  };
}
