// Search, member lists, batches, BlackList, staff, expenses, BackDate and
// Biometric Management. Runs as the Alpha gym owner.
import { BASE, choose, pickDate, signIn, startBrowser, startMachine, toast } from "./lib.mjs";

const { page, step, finish } = await startBrowser("features");
console.log("Features");
const card = (label) => page.locator("[data-slot=card]", { hasText: label }).first();
const openMember = async (name) => {
  await page.goto(`${BASE}/members`);
  await page.locator("tr", { hasText: name }).getByText(name).first().click();
  await page.waitForURL(/\/members\/[0-9a-f-]{36}$/);
};
// Picks a day in an earlier month in the app's date picker.
const pickPastDate = async (index, monthsBack, day = "10") => {
  await page.getByRole("button", { name: /Pick a date|\d{4}$/ }).nth(index).click();
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const target = new Date(); target.setMonth(target.getMonth() - monthsBack);
  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  if (monthsBack === 0) {
    await popover.getByRole("gridcell", { name: day, exact: true }).first().click();
    // Inside a dialog, Escape would close the dialog too; click away instead.
    await page.getByRole("dialog").getByText("Amount received").click();
    return;
  }
  await popover.getByRole("combobox").nth(1).click(); await page.getByRole("option", { name: String(target.getFullYear()), exact: true }).click();
  await popover.getByRole("combobox").nth(0).click(); await page.getByRole("option", { name: months[target.getMonth()], exact: true }).click();
  await popover.getByRole("gridcell", { name: day, exact: true }).first().click();
  await page.keyboard.press("Escape");
};

await step("owner signs in", async () => {
  await signIn(page, "9811111111", "password-1111");
  await page.getByText("Collected today").waitFor();
});
await step("Universal Search Member finds a member by phone and opens them", async () => {
  await page.getByPlaceholder(/Universal Search Member/).fill("98765111");
  await page.getByRole("button", { name: /Alice Alpha/ }).click();
  await page.waitForURL(/\/members\/[0-9a-f-]{36}$/); await page.getByRole("heading", { name: /Alice Alpha/ }).waitFor();
});
await step("View Batch: add a batch and put a member in it", async () => {
  await page.goto(`${BASE}/members/batches`);
  await page.getByRole("button", { name: "Add Batch" }).click();
  await page.getByPlaceholder("Morning").fill("Morning");
  await page.getByRole("button", { name: "Save" }).click(); await toast(page, "Batch saved");
  await openMember("Alice Alpha");
  await page.getByRole("combobox").filter({ hasText: "No batch" }).click(); await page.getByRole("option", { name: /Morning/ }).click();
  await toast(page, "Batch updated");
  await page.goto(`${BASE}/members/batches`); await page.getByText("1 member").waitFor();
});
await step("BackDate Add Member + BackDate Renew Subscription: old, expired, no messages", async () => {
  await page.goto(`${BASE}/members/new?backdate=1`);
  await page.getByRole("heading", { name: "BackDate Add Member" }).waitFor();
  await page.getByPlaceholder("Name", { exact: true }).fill("old expired"); await page.getByPlaceholder("Phone", { exact: true }).fill("9876522233");
  await pickDate(page);
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/sales\/new\?member=.*backdate=1/, { timeout: 20000 });
  await page.getByRole("heading", { name: "BackDate Renew Subscription" }).waitFor();
  await choose(page, "Select a plan", "Monthly Gym");
  await pickPastDate(0, 3);
  await page.getByRole("button", { name: /Paid in full/ }).click();
  await page.getByRole("button", { name: "Create" }).click();
  await toast(page, "Old record: no invoice sent");
  await page.waitForURL(/\/members\/[0-9a-f-]{36}$/, { timeout: 20000 });
});
await step("InActive and Pending Renewal views list the expired member", async () => {
  await page.goto(`${BASE}/members?view=inactive`); await page.getByRole("heading", { name: "InActive Member" }).waitFor();
  await page.locator("tr", { hasText: "Old Expired" }).waitFor();
  await page.goto(`${BASE}/members?view=renewal`); await page.getByRole("heading", { name: "View Pending Renewal" }).waitFor();
  await page.goto(`${BASE}/members?view=dormant`); await page.getByRole("heading", { name: "Dormant Member" }).waitFor();
});
await step("Back Date Add Enquiry keeps its date and sends nothing", async () => {
  await page.goto(`${BASE}/enquiries/new?backdate=1`);
  await page.getByRole("heading", { name: "Back Date Add Enquiry" }).waitFor();
  await page.getByPlaceholder("Name", { exact: true }).fill("old lead"); await page.getByPlaceholder("10 digit mobile number").fill("9876522244");
  await pickPastDate(0, 1); await pickDate(page, "15", 1);
  await page.getByRole("button", { name: "Create" }).click(); await toast(page, "Enquiry added successfully");
});
await step("BackDate Others: an old payment with a past date", async () => {
  await page.goto(`${BASE}/backdate`);
  const row = page.locator("div.rounded-md", { hasText: "Amit Shah" }).first();
  await row.getByRole("button", { name: "Record old payment" }).click();
  await page.getByRole("dialog").locator("input[type=number]").fill("1234");
  await pickPastDate(0, 0, "1");
  await page.getByRole("button", { name: "Save payment" }).click(); await toast(page, "₹1,234 received");
});
await step("no WhatsApp message was queued for any BackDate entry", async () => {
  await page.goto(`${BASE}/whatsapp`); await page.getByRole("tab", { name: "Sent messages" }).click();
  await page.getByText(/thanks for your interest/).first().waitFor();
  for (const text of ["Old Expired", "Old Lead", "₹1,234"]) {
    if (await page.locator("div.rounded-lg.border", { hasText: text }).filter({ hasNot: page.getByText("offer") }).count()) {
      const offerOnly = await page.locator("div.rounded-lg.border", { hasText: text }).filter({ hasText: "20% off" }).count();
      if (offerOnly === 0) throw new Error(`a message mentions ${text}`);
    }
  }
});
await step("Staff Management: add staff and give a front-desk login", async () => {
  await page.goto(`${BASE}/staff`);
  await page.getByRole("button", { name: "Add Staff" }).click();
  const inputs = page.getByRole("dialog").locator("input");
  await inputs.nth(0).fill("sita front"); await inputs.nth(1).fill("9833333333");
  await page.getByRole("button", { name: "Save" }).click(); await toast(page, "Staff saved");
  await page.locator("div.rounded-lg.border", { hasText: "Sita Front" }).getByRole("button", { name: "Give login" }).click();
  await page.getByRole("dialog").locator("input").fill("password-3333");
  await page.getByRole("button", { name: "Save" }).click(); await toast(page, "can now sign in");
});
await step("Staff Attendance: mark in, then out", async () => {
  await page.goto(`${BASE}/staff-attendance`);
  const row = page.locator("div.rounded-md", { hasText: "Sita Front" }).first();
  await row.getByRole("button", { name: "Mark in" }).click(); await toast(page, "Sita Front marked in");
  await row.getByRole("button", { name: "Mark out" }).click(); await toast(page, "Sita Front marked out");
});
await step("Expense Management: an expense lowers this month's profit", async () => {
  await page.goto(`${BASE}/expenses`);
  await page.locator("input[type=number]").first().fill("5000");
  await page.getByRole("button", { name: "Add Expense" }).click(); await toast(page, "₹5,000 Rent added");
  await card("Spent").getByText("₹5,000").waitFor();
});
let machine;
await step("Biometric: Add Biometric sends the member to the machine", async () => {
  await page.goto(`${BASE}/attendance/biometric?tab=machines`);
  await page.getByPlaceholder("Machine serial number").fill("SIM-ALPHA-02");
  await page.getByRole("button", { name: "Add machine" }).click(); await toast(page, "Machine added");
  machine = startMachine("SIM-ALPHA-02", ["--users", "0", "--history-days", "0"]);
  await machine.waitFor(/connected as SIM-ALPHA-02/);
  await page.goto(`${BASE}/attendance/biometric?tab=enroll`);
  await choose(page, "Select member", "Alice Alpha");
  await page.getByRole("button", { name: "Enroll" }).first().click(); await toast(page, "Sent to the machine as ID");
  await machine.waitFor(/machine now has ID (\d+) \(Alice Alpha\)/);
  await page.goto(`${BASE}/attendance/biometric?tab=commands`); await page.getByText("Done").first().waitFor({ timeout: 20000 });
});
await step("Biometric: a punch on the machine marks attendance", async () => {
  const pin = /machine now has ID (\d+) \(Alice Alpha\)/.exec(machine.output())[1];
  machine.punch(pin); await machine.waitFor(/punch accepted/);
  await page.goto(`${BASE}/attendance`); await page.locator("a", { hasText: "Alice Alpha" }).waitFor({ timeout: 15000 });
});
await step("Block Biometric removes the member; the machine then refuses them", async () => {
  await page.goto(`${BASE}/attendance/biometric?tab=block`);
  await page.locator("div.rounded-md", { hasText: "Alice Alpha" }).getByRole("button", { name: "Block" }).click(); await toast(page, "Block sent");
  await machine.waitFor(/removed ID \d+ from the machine/);
  const pin = /machine now has ID (\d+) \(Alice Alpha\)/.exec(machine.output())[1];
  machine.punch(pin); await machine.waitFor(new RegExp(`ID ${pin} is not enrolled`));
});
await step("Unblock puts them back on the machine", async () => {
  await page.locator("div.rounded-md", { hasText: "Alice Alpha" }).getByRole("button", { name: "Unblock" }).click();
  await toast(page, "Sent to the machine as ID");
  await machine.waitFor(/machine now has ID \d+ \(Alice Alpha\)[\s\S]*machine now has ID \d+ \(Alice Alpha\)/);
});
await step("Delete Biometric frees the ID", async () => {
  await page.goto(`${BASE}/attendance/biometric?tab=delete`);
  await page.locator("div.rounded-md", { hasText: "Alice Alpha" }).getByRole("button", { name: "Delete" }).click(); await toast(page, "Delete sent");
  await machine.waitFor(/removed ID \d+ from the machine[\s\S]*removed ID \d+ from the machine/);
  machine.stop();
});
await step("auto-block switch turns on and off", async () => {
  await page.goto(`${BASE}/attendance/biometric?tab=block`);
  await page.getByRole("switch").click(); await toast(page, "Auto-block on");
  await page.getByRole("switch").click(); await toast(page, "Auto-block off");
});
await step("BlackList: member refused at check-in and listed under BlackList Member", async () => {
  await openMember("Alice Alpha");
  await page.getByRole("button", { name: "BlackList", exact: true }).click(); await toast(page, "Added to BlackList");
  await page.getByText("BlackList Member.").waitFor();
  await page.goto(`${BASE}/attendance`);
  await choose(page, "Select Member", "Alice Alpha");
  await page.getByRole("button", { name: "Check In" }).click(); await toast(page, "is blacklisted");
  await page.goto(`${BASE}/members?view=blacklist`); await page.locator("tr", { hasText: "Alice Alpha" }).waitFor();
  await openMember("Alice Alpha");
  await page.getByRole("button", { name: "Remove from BlackList" }).click(); await toast(page, "Removed from BlackList");
});

machine?.stop();
process.exitCode = await finish();
