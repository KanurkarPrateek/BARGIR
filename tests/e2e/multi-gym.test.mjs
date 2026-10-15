// Two gyms in one database: each sees only its own data.
import { ADMIN_LOGIN, ADMIN_PASSWORD, BASE, choose, pickDate, signIn, simulateOnce, startBrowser, toast } from "./lib.mjs";

const { page, step, finish } = await startBrowser("multi-gym");
console.log("Multi-gym");
let memberId, invoiceUrl;

await step("wrong admin password is refused", async () => {
  await signIn(page, ADMIN_LOGIN, "not-the-password");
  await toast(page, "Wrong phone number or password");
});
await step("admin signs in to the gym list", async () => {
  await signIn(page, ADMIN_LOGIN, ADMIN_PASSWORD);
  await page.waitForURL(/admin\/gyms/);
});
for (const [gym, owner, phone] of [["Alpha Fitness", "asha owner", "9811111111"], ["Beta Gym", "bala owner", "9822222222"]]) {
  await step(`admin creates ${gym}`, async () => {
    await page.getByRole("button", { name: "Add gym" }).click();
    const inputs = page.getByRole("dialog").locator("input");
    await inputs.nth(0).fill(gym); await inputs.nth(1).fill(owner); await inputs.nth(2).fill(phone); await inputs.nth(3).fill("password-" + phone.slice(-4));
    await page.getByRole("button", { name: "Create gym" }).click();
    await toast(page, "Gym created");
  });
}
await step("a phone number can own only one login", async () => {
  await page.getByRole("button", { name: "Add gym" }).click();
  const inputs = page.getByRole("dialog").locator("input");
  await inputs.nth(0).fill("Dup"); await inputs.nth(1).fill("X"); await inputs.nth(2).fill("9811111111"); await inputs.nth(3).fill("password-xx");
  await page.getByRole("button", { name: "Create gym" }).click();
  await toast(page, "already has a login");
  await page.keyboard.press("Escape");
});
await step("an owner cannot open the admin pages", async () => {
  await signIn(page, "9811111111", "password-1111");
  await page.waitForURL(/dashboard/);
  await page.goto(`${BASE}/admin/gyms`);
  await page.waitForURL(/signin/);
});
await step("Alpha: package, member and subscription with a balance", async () => {
  await signIn(page, "9811111111", "password-1111");
  await page.waitForURL(/dashboard/);
  await page.goto(`${BASE}/services/new`);
  await page.getByPlaceholder("Name", { exact: true }).fill("Alpha Monthly"); await page.getByPlaceholder("Price").fill("1500"); await page.getByPlaceholder("Duration").fill("1");
  await page.getByRole("button", { name: "Create" }).click(); await toast(page, "Service added successfully");
  await page.goto(`${BASE}/members/new`);
  await page.getByPlaceholder("Name", { exact: true }).fill("alice alpha"); await page.getByPlaceholder("Phone", { exact: true }).fill("9876511111"); await pickDate(page);
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/sales\/new\?member=/, { timeout: 20000 });
  await choose(page, "Select a plan", "Alpha Monthly");
  await page.getByPlaceholder("0 if paying later").fill("500");
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/members\/[0-9a-f-]{36}$/, { timeout: 20000 });
  await page.getByText("₹1,000 due").waitFor();
  memberId = page.url().split("/").pop();
  invoiceUrl = BASE + (await page.getByRole("link", { name: "Invoice" }).first().getAttribute("href"));
});
await step("Alpha: Gym Settings save address, GST and logo", async () => {
  await page.goto(`${BASE}/settings`);
  await page.waitForFunction(() => [...document.querySelectorAll("input")].some((i) => i.value === "Alpha Fitness"));
  const inputs = page.locator("[data-slot=card]").first().locator("input:not([type=file])");
  await inputs.nth(1).fill("12 MG Road, Pune"); await inputs.nth(4).fill("27abcde1234f1z5");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC", "base64");
  await page.locator("input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await page.getByAltText("Gym logo").waitFor();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator('a img[src^="data:image"]').first().waitFor({ timeout: 20000 });
});
await step("Alpha: WhatsApp page shows the QR to link a number", async () => {
  await page.goto(`${BASE}/whatsapp`);
  await page.getByAltText("WhatsApp QR code").waitFor({ timeout: 30000 });
});
await step("Alpha: registered machine's punches are accepted", async () => {
  await page.goto(`${BASE}/attendance/biometric?tab=machines`);
  await page.getByPlaceholder("Machine serial number").fill("SIM-ALPHA-01");
  await page.getByRole("button", { name: "Add machine" }).click(); await toast(page, "Machine added");
  const out = await simulateOnce("SIM-ALPHA-01", ["--history-days", "1", "--users", "3"]);
  if (!/punch(es)? accepted/.test(out)) throw new Error("simulator: " + out.slice(-200));
});
await step("an unregistered machine is refused and keeps its punches", async () => {
  const out = await simulateOnce("SIM-UNKNOWN-9", ["--history-days", "1", "--users", "2"]);
  if (!/held on the machine, server said 403/.test(out)) throw new Error(out.slice(-200));
});
await step("Beta sees none of Alpha's data", async () => {
  await signIn(page, "9822222222", "password-2222");
  await page.waitForURL(/dashboard/);
  for (const [path, text] of [["/members", "Alice Alpha"], ["/services", "Alpha Monthly"], ["/sales", "Alice Alpha"], ["/payments", "Alice Alpha"], ["/attendance/biometric?tab=machines", "SIM-ALPHA-01"]]) {
    await page.goto(BASE + path); await page.waitForTimeout(1500);
    if (await page.getByText(text).count()) throw new Error(`${text} visible on ${path}`);
  }
});
await step("Beta cannot claim Alpha's machine", async () => {
  await page.goto(`${BASE}/attendance/biometric?tab=machines`);
  await page.getByPlaceholder("Machine serial number").fill("SIM-ALPHA-01");
  await page.getByRole("button", { name: "Add machine" }).click(); await toast(page, "registered to another gym");
});
await step("Beta cannot open Alpha's member by link", async () => {
  await page.goto(`${BASE}/members/${memberId}`); await page.getByText("Member not found.").waitFor();
});
await step("public invoice shows Alpha's own details without login", async () => {
  await page.context().clearCookies(); await page.goto(invoiceUrl);
  await page.getByText("12 MG Road, Pune").waitFor(); await page.getByText("GSTIN: 27ABCDE1234F1Z5").waitFor();
});
await step("a switched-off gym cannot sign in, and can again when switched on", async () => {
  await signIn(page, ADMIN_LOGIN, ADMIN_PASSWORD); await page.waitForURL(/admin\/gyms/);
  const beta = page.locator("div.rounded-lg.border", { hasText: "Beta Gym" });
  await beta.getByRole("button", { name: "Switch off" }).click(); await page.getByText("Switched off").waitFor();
  await signIn(page, "9822222222", "password-2222"); await toast(page, "switched off");
  await signIn(page, ADMIN_LOGIN, ADMIN_PASSWORD); await page.waitForURL(/admin\/gyms/);
  await page.locator("div.rounded-lg.border", { hasText: "Beta Gym" }).getByRole("button", { name: "Switch on" }).click();
});
await step("admin can open a gym and step back out", async () => {
  await page.locator("div.rounded-lg.border", { hasText: "Alpha Fitness" }).getByRole("button", { name: "Open" }).click();
  await page.waitForURL(/dashboard/);
  await page.getByRole("button", { name: "All gyms" }).or(page.getByRole("link", { name: "All gyms" })).first().click();
  await page.waitForURL(/admin\/gyms/);
});

process.exitCode = await finish();
