// A front-desk staff login: can run the desk, cannot see money reports,
// expenses, staff or setup.
import { BASE, choose, signIn, startBrowser, toast } from "./lib.mjs";

const { page, step, finish } = await startBrowser("front-desk");
console.log("Front desk login");

await step("staff member signs in with their own phone number", async () => {
  await signIn(page, "9833333333", "password-3333");
  await page.getByText("Collected today").waitFor();
});
await step("monthly revenue is hidden on the dashboard", async () => {
  await page.getByText("Pending dues").waitFor();
  await page.waitForTimeout(1500);
  if (await page.getByText("Collected this month").count()) throw new Error("monthly revenue visible");
});
await step("owner-only menus are hidden", async () => {
  for (const name of ["Expense Management", "Staff Management", "Package Management", "WhatsApp Management", "Gym Settings", "Trainer Management"]) {
    if (await page.getByRole("button", { name }).or(page.getByRole("link", { name })).count()) throw new Error(`${name} visible`);
  }
});
await step("owner-only pages send them back to the dashboard", async () => {
  for (const path of ["/payments", "/expenses", "/staff", "/settings", "/whatsapp", "/services", "/trainers", "/analytics"]) {
    await page.goto(BASE + path); await page.waitForURL(/dashboard/);
  }
});
await step("front-desk work still works: add an enquiry and check a member in", async () => {
  await page.goto(`${BASE}/enquiries/new`);
  await page.getByPlaceholder("Name", { exact: true }).fill("desk lead"); await page.getByPlaceholder("10 digit mobile number").fill("9876533344");
  await page.getByRole("button", { name: /Pick a date/ }).first().click(); await page.getByRole("gridcell", { name: "20", exact: true }).first().click(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Create" }).click(); await toast(page, "Enquiry added successfully");
  await page.goto(`${BASE}/attendance`);
  await choose(page, "Select Member", "Old Expired");
  await page.getByRole("button", { name: "Check In" }).click(); await toast(page, "Attendance added successfully");
});
await step("deleting enquiries and machine setup are owner-only", async () => {
  await page.goto(`${BASE}/enquiries`);
  await page.getByText("desk lead").first().waitFor(); await page.waitForTimeout(1000);
  if (await page.getByRole("button", { name: "Delete" }).count()) throw new Error("enquiry Delete visible");
  await page.goto(`${BASE}/attendance/biometric`);
  await page.getByRole("tab", { name: "Block Biometric" }).waitFor(); await page.waitForTimeout(1000);
  for (const name of ["Delete Biometric", "Machine Setup"]) {
    if (await page.getByRole("tab", { name }).count()) throw new Error(`${name} visible`);
  }
});
await step("owner removes the login;the staff member can no longer sign in", async () => {
  await signIn(page, "9811111111", "password-1111"); await page.waitForURL(/dashboard/);
  await page.goto(`${BASE}/staff`);
  await page.locator("div.rounded-lg.border", { hasText: "Sita Front" }).getByRole("button", { name: "Remove login" }).click();
  await page.waitForTimeout(800);
  await signIn(page, "9833333333", "password-3333"); await toast(page, "Wrong phone number or password");
});

process.exitCode = await finish();
