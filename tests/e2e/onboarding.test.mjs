// A brand-new gym onboarding itself: sign-up, setup wizard, Excel member
// import and tap-to-claim biometric machine.
import * as XLSX from "xlsx";
import { BASE, signIn, simulateOnce, startBrowser, toast } from "./lib.mjs";

const { page, step, finish } = await startBrowser("onboarding");
console.log("Onboarding");
const fmt = (d) => `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
const daysAgo = (n) => fmt(new Date(Date.now() - n * 86400000));

await step("a gym owner signs up and lands in the setup wizard", async () => {
  await page.context().clearCookies();
  await page.goto(`${BASE}/signin`);
  await page.getByRole("link", { name: "Start here" }).click();
  await page.locator("#gymName").fill("Gamma Gym"); await page.locator("#ownerName").fill("gita owner");
  await page.locator("#phone").fill("9844444444"); await page.locator("#password").fill("password-4444");
  await page.getByRole("button", { name: "Create my gym" }).click();
  await page.waitForURL(/\/setup/); await page.getByText("Step 1 of 6").waitFor();
});
await step("signing up again with the same phone is refused", async () => {
  const other = await page.context().browser().newPage();
  await other.goto(`${BASE}/signup`);
  await other.locator("#gymName").fill("Dup"); await other.locator("#ownerName").fill("X");
  await other.locator("#phone").fill("9844444444"); await other.locator("#password").fill("password-xxxx");
  await other.getByRole("button", { name: "Create my gym" }).click();
  await other.getByText("already has an account").first().waitFor();
  await other.close();
});
await step("step 1: gym details", async () => {
  await page.getByPlaceholder("Shop no., street, city").fill("5 Station Road, Nagpur");
  await page.getByRole("button", { name: "Save and continue" }).click(); await toast(page, "Saved");
  await page.getByText("Step 2 of 6").waitFor();
});
await step("step 2: starter packages in one click", async () => {
  await page.getByRole("button", { name: "Add packages and continue" }).click(); await toast(page, "4 packages added");
  await page.getByText("Step 3 of 6").waitFor();
});
await step("step 3: starter batches", async () => {
  await page.getByRole("button", { name: "Add batches and continue" }).click(); await toast(page, "Batches added");
  await page.getByText("Step 4 of 6").waitFor();
});
await step("step 4: import members from Excel, with problems reported per row", async () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Name", "Mobile No", "Gender", "Joining Date", "Plan", "Start Date", "Amount Paid"],
    ["ravi kumar", "9876544401", "M", daysAgo(200), "", "", ""],
    ["sunita rao", "+91 98765 44402", "Female", daysAgo(40), "Monthly", daysAgo(10), "1000"],
    ["arjun mehta", "09876544403", "male", daysAgo(90), "Quarterly", daysAgo(60), "1500"],
    ["bad phone", "12345", "", "", "", "", ""],
    ["no such plan", "9876544405", "", "", "Platinum", daysAgo(5), "500"],
  ]);
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  await page.locator("input[type=file]").setInputFiles({ name: "register.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  await page.getByText("5 members found in register.xlsx").waitFor();
  await page.getByRole("button", { name: "Import 5 members" }).click();
  await page.getByText("imported,").waitFor({ timeout: 30000 });
  const summary = await page.getByText("imported,").innerText();
  if (!/3 imported, 2 with a running package/.test(summary)) throw new Error(summary);
  await page.getByText(/Row 5 · Bad Phone|Row 5 · bad phone/).waitFor();
  await page.getByText(/Row 6 .*Package "Platinum" does not exist/).waitFor();
  await page.getByRole("button", { name: /Continue with 3 members/ }).click();
  await page.getByText("Step 5 of 6").waitFor();
});
await step("step 5: WhatsApp QR is shown", async () => {
  await page.getByAltText("WhatsApp QR code").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Continue" }).click(); await page.getByText("Step 6 of 6").waitFor();
});
await step("step 6: a machine that connects can be claimed in one tap", async () => {
  const first = await simulateOnce("GAMMA-01", ["--history-days", "1", "--users", "2"]);
  if (!/403/.test(first)) throw new Error("unclaimed machine was not refused: " + first.slice(-150));
  // Other gyms' unclaimed machines may be listed too; pick ours by serial.
  await page.locator("div.rounded-lg.border", { hasText: "GAMMA-01" }).getByRole("button", { name: "This is my machine" }).click({ timeout: 20000 });
  await toast(page, "Machine added");
  await page.getByText("1 machine added").waitFor();
  // Accepted means its user list goes in (punches are random and may be none).
  const second = await simulateOnce("GAMMA-01", ["--history-days", "3", "--users", "2"]);
  if (!/sent \d+ enrolled people/.test(second)) throw new Error("claimed machine not accepted: " + second.slice(-150));
});
await step("finishing setup goes to the dashboard without the setup reminder", async () => {
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.waitForURL(/dashboard/); await page.getByText("Collected today").waitFor();
  await page.waitForTimeout(1500);
  if (await page.getByText("Finish setting up your gym").count()) throw new Error("setup banner still shown");
});
await step("imported members, memberships and payments are in place, and nobody was messaged", async () => {
  await page.goto(`${BASE}/members`); await page.locator("tr", { hasText: "Arjun Mehta" }).waitFor();
  await page.goto(`${BASE}/members?view=active`); await page.locator("tr", { hasText: "Sunita Rao" }).waitFor();
  await page.locator("tr", { hasText: "Sunita Rao" }).getByText("Sunita Rao").click();
  await page.getByRole("tab", { name: "Payments (1)" }).waitFor();
  await page.goto(`${BASE}/whatsapp`); await page.getByRole("tab", { name: "Sent messages" }).click();
  await page.getByText("Nothing sent yet.").waitFor();
});
await step("importing the same file again skips existing members", async () => {
  await page.goto(`${BASE}/members/import`);
  const sheet = XLSX.utils.aoa_to_sheet([["Name", "Phone"], ["Ravi Kumar", "9876544401"]]);
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "S");
  await page.locator("input[type=file]").setInputFiles({ name: "again.csv", mimeType: "text/csv", buffer: Buffer.from(XLSX.utils.sheet_to_csv(sheet)) });
  await page.getByRole("button", { name: "Import 1 member" }).click();
  await page.getByText("Already a member").waitFor({ timeout: 20000 });
});
await step("an owner who skips setup sees the reminder on the dashboard", async () => {
  await signIn(page, "9811111111", "password-1111");
  await page.getByText("Finish setting up your gym").waitFor();
});

process.exitCode = await finish();
