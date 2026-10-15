// A gym owner's normal day: packages, enquiries, members, subscriptions,
// payments, trainers, attendance and WhatsApp. Runs as the Alpha gym owner
// created by multi-gym.test.mjs.
import { BASE, choose, pickDate, signIn, startBrowser, toast } from "./lib.mjs";

const { page, step, finish } = await startBrowser("daily");
console.log("Daily flows");
const card = (label) => page.locator("[data-slot=card]", { hasText: label }).first();

await step("owner signs in", async () => {
  await signIn(page, "9811111111", "password-1111");
  await page.getByText("Collected today").waitFor();
});
await step("Add Package: Monthly Gym and a personal training package", async () => {
  for (const [name, price, pt] of [["Monthly Gym", "1000", false], ["PT Monthly", "5000", true]]) {
    await page.goto(`${BASE}/services/new`);
    await page.getByPlaceholder("Name", { exact: true }).fill(name); await page.getByPlaceholder("Price").fill(price); await page.getByPlaceholder("Duration").fill("1");
    if (pt) await page.getByRole("switch").click();
    await page.getByRole("button", { name: "Create" }).click(); await toast(page, "Service added successfully");
  }
  await page.goto(`${BASE}/services`);
  const pt = page.locator("div.rounded-lg.border", { hasText: "PT Monthly" }).first().getByRole("switch");
  if ((await pt.getAttribute("aria-checked")) !== "true") throw new Error("PT switch not saved");
});
await step("trainer: invalid phone refused, +91 format accepted", async () => {
  await page.goto(`${BASE}/trainers`);
  await page.getByRole("button", { name: "Add trainer" }).click();
  const inputs = page.getByRole("dialog").locator("input");
  await inputs.nth(0).fill("ravi kumar"); await inputs.nth(1).fill("1234567890");
  await page.getByRole("button", { name: "Save" }).click(); await toast(page, "valid 10-digit Indian mobile");
  await inputs.nth(1).fill("+91 98123 45678");
  await page.getByRole("button", { name: "Save" }).click(); await toast(page, "Trainer saved");
});
await step("Add Enquiry assigned to the trainer", async () => {
  await page.goto(`${BASE}/enquiries/new`);
  await page.getByPlaceholder("Name", { exact: true }).fill("amit shah"); await page.getByPlaceholder("10 digit mobile number").fill("9876501234");
  await pickDate(page); await page.getByPlaceholder("Message").fill("Wants weight loss");
  await page.getByRole("combobox").filter({ hasText: "No trainer" }).click(); await page.getByRole("option", { name: "Ravi Kumar" }).click();
  await page.getByRole("button", { name: "Create" }).click(); await toast(page, "Enquiry added successfully");
});
await step("View Enquiry → Make member pre-fills the form", async () => {
  await page.goto(`${BASE}/enquiries`);
  await page.locator("div.rounded-lg.border", { hasText: "Amit Shah" }).getByRole("button", { name: "Make member" }).click();
  await page.waitForFunction(() => document.querySelector('input[placeholder="Name"]')?.value === "Amit Shah");
  await pickDate(page); await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/sales\/new\?member=/, { timeout: 20000 });
});
await step("Add Subscription with part payment, then collect the rest", async () => {
  await choose(page, "Select a plan", "Monthly Gym");
  await page.getByPlaceholder("0 if paying later").fill("400");
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/members\/[0-9a-f-]{36}$/, { timeout: 20000 });
  await page.getByText("₹600 due").waitFor();
  await page.getByRole("button", { name: "Collect" }).first().click();
  await page.getByRole("dialog").getByRole("combobox").click(); await page.getByRole("option", { name: "UPI" }).click();
  await page.getByRole("button", { name: "Save payment" }).click(); await toast(page, "₹600 received");
});
await step("the enquiry is now Joined", async () => {
  await page.goto(`${BASE}/enquiries`); await page.getByText(/Joined \(1\)/).waitFor();
});
await step("Payment Report shows today's cash and UPI", async () => {
  await page.goto(`${BASE}/payments`);
  // Cash also includes the multi-gym suite's ₹500 from earlier today.
  await card("Cash").getByText("₹900").waitFor(); await card("UPI").getByText("₹600").waitFor();
  await page.getByRole("link", { name: /Amit Shah/ }).first().waitFor();
});
await step("unpaid PT package shows in Pending Payments and PT clients", async () => {
  await page.goto(`${BASE}/members`); await page.locator("tr", { hasText: "Amit Shah" }).getByText("Amit Shah").click();
  await page.getByRole("link", { name: "Renew / new sale" }).click(); await page.waitForURL(/sales\/new/);
  await choose(page, "Monthly Gym", "PT Monthly");
  await page.getByText("This is a personal training package").waitFor();
  await page.getByRole("button", { name: "Create" }).click(); await page.waitForURL(/\/members\/[0-9a-f-]{36}$/, { timeout: 20000 });
  await page.goto(`${BASE}/sales/pending-payments`); await page.locator("tr", { hasText: "Amit Shah" }).waitFor();
  await page.goto(`${BASE}/trainers`); await page.getByRole("tab", { name: /PT clients/ }).click(); await page.getByText("PT Monthly").first().waitFor();
});
await step("Pending Payments: the message button sends from the app, not WhatsApp in the browser", async () => {
  await page.goto(`${BASE}/sales/pending-payments`);
  const before = page.context().pages().length;
  await page.locator("tr", { hasText: "Amit Shah" }).getByTitle("Send on WhatsApp").click();
  await toast(page, "is on its way");
  if (page.context().pages().length !== before) throw new Error("a WhatsApp window opened");
  await page.goto(`${BASE}/whatsapp?tab=log`);
  await page.getByText(/Balance due: \*₹5,000\*/).first().waitFor();
});
await step("Member Attendance: check in", async () => {
  await page.goto(`${BASE}/attendance`);
  await choose(page, "Select Member", "Amit Shah");
  await page.getByRole("button", { name: "Check In" }).click(); await toast(page, "Attendance added successfully");
});
await step("WhatsApp: welcome, invoice and receipt are queued", async () => {
  await page.goto(`${BASE}/whatsapp`); await page.getByRole("tab", { name: "Sent messages" }).click();
  await page.getByText(/Thank you for your interest in \*Alpha Fitness\*/).first().waitFor();
  await page.getByText(/Thank you for choosing \*Alpha Fitness\*/).first().waitFor();
  await page.getByText(/Payment received, thank you/).first().waitFor();
});
await step("WhatsApp: create a workflow and preview it", async () => {
  await page.getByRole("tab", { name: "Workflows" }).click();
  await page.getByRole("button", { name: "New workflow" }).click();
  await page.getByPlaceholder("e.g. Renewal reminder").fill("Expiring in 7 days");
  await page.getByRole("dialog").getByRole("combobox").nth(1).click(); await page.getByRole("option", { name: "before" }).click();
  await page.getByRole("dialog").locator("input[type=number]").fill("7");
  await page.getByRole("dialog").locator("textarea").fill("Hi {first_name}, renew before {expiry_date}");
  await page.getByText("Hi Rahul, renew before 15-10-2026").waitFor();
  await page.getByRole("button", { name: "Save" }).click(); await toast(page, "Workflow saved");
});
await step("WhatsApp: send an offer to everyone by name", async () => {
  await page.getByRole("tab", { name: "Offers" }).click();
  await page.getByPlaceholder("e.g. Diwali offer").fill("Test offer");
  await page.locator("textarea").fill("Hi {first_name}, 20% off this week at {gym}!");
  await page.getByRole("button", { name: "Send offer" }).click(); await toast(page, "Offer queued");
});
await step("invoice page renders", async () => {
  await page.goto(`${BASE}/members`); await page.locator("tr", { hasText: "Amit Shah" }).getByText("Amit Shah").click();
  const href = await page.getByRole("link", { name: "Invoice" }).first().getAttribute("href");
  await page.goto(BASE + href); await page.getByText("Amit Shah").first().waitFor();
});
await step("every main page opens without crashing", async () => {
  for (const p of ["/dashboard", "/members", "/members/batches", "/sales", "/sales/followups", "/enquiries/followups", "/members/birthdays", "/tools", "/attendance/history", "/staff-attendance", "/backdate", "/expenses", "/staff", "/settings", "/sales/pending-payments"]) {
    const r = await page.goto(BASE + p);
    if (r.status() !== 200) throw new Error(`${p} -> ${r.status()}`);
    await page.waitForTimeout(500);
    if (await page.getByText(/Application error|Unhandled Runtime Error/).count()) throw new Error(`${p} crashed`);
  }
});
await step("removed pages are gone", async () => {
  for (const p of ["/todo", "/diet", "/fitness-record", "/exercise-iput", "/sales/invoices"]) {
    const r = await page.goto(BASE + p);
    if (r.status() !== 404) throw new Error(`${p} -> ${r.status()}`);
  }
});

process.exitCode = await finish();
