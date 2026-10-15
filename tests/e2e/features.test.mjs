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
  await page.getByText(/Thank you for your interest/).first().waitFor();
  for (const text of ["Old Expired", "Old Lead", "₹1,234"]) {
    if (await page.locator("div.rounded-lg.border", { hasText: text }).filter({ hasNot: page.getByText("offer") }).count()) {
      const offerOnly = await page.locator("div.rounded-lg.border", { hasText: text }).filter({ hasText: "20% off" }).count();
      if (offerOnly === 0 && !(await page.locator("div.rounded-lg.border", { hasText: text }).filter({ hasText: "Special offer" }).count())) throw new Error(`a message mentions ${text}`);
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
await step("Edit Package: a 10% offer shows on View Package", async () => {
  await page.goto(`${BASE}/services`);
  const card = page.locator("div.rounded-lg.border", { hasText: "Monthly Gym" }).first();
  await card.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByRole("combobox").filter({ hasText: "No offer" }).click();
  await page.getByRole("option", { name: "% off" }).click();
  await page.getByRole("dialog").getByPlaceholder("10").fill("10");
  await page.getByText("Members pay ₹900 instead of ₹1,000").waitFor();
  await page.getByRole("button", { name: "Save" }).click(); await toast(page, "Package saved");
  await page.locator("div.rounded-lg.border", { hasText: "Monthly Gym" }).first().getByText("10% off").waitFor();
});
await step("the offer is applied automatically on Add Subscription", async () => {
  await page.goto(`${BASE}/sales/new`);
  await choose(page, "Select a plan", "Monthly Gym");
  await page.getByText("Offer applied: 10% off").waitFor();
  if ((await page.getByPlaceholder("Discount").inputValue()) !== "100") throw new Error("discount not filled");
});
await step("Send offer opens WhatsApp Offers with a ready message and sends it by name", async () => {
  await page.goto(`${BASE}/services`);
  await page.locator("div.rounded-lg.border", { hasText: "Monthly Gym" }).first().getByRole("button", { name: "Send offer" }).click();
  await page.waitForURL(/whatsapp\?tab=offers&package=/);
  await page.waitForFunction(() => document.querySelector("textarea")?.value.includes("{offer_price}"));
  await page.getByText(/now just \*₹900\* ~₹1,000~/).first().waitFor();
  await page.getByRole("button", { name: "Send offer" }).click(); await toast(page, "Offer queued");
  await page.getByRole("tab", { name: "Sent messages" }).click();
  await page.getByText(/\*Monthly Gym\* now just \*₹900\* ~₹1,000~/).first().waitFor();
});
await step("Sales Analytics: totals, charts and Excel download", async () => {
  await page.goto(`${BASE}/analytics`);
  await page.getByText("Sold vs collected, last 12 months").waitFor();
  for (const label of ["Sales value", "Collected", "New members", "Renewal rate", "Outstanding dues", "Enquiry conversion"]) {
    await page.getByText(label, { exact: true }).first().waitFor();
  }
  await page.getByText("Sales by package").waitFor();
  await page.locator("td", { hasText: "Monthly Gym" }).first().waitFor();
  await page.getByRole("button", { name: "Show as table" }).click(); await page.getByRole("button", { name: "Show chart" }).waitFor();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download Excel" }).click()]);
  if (!/^sales-.*\.xlsx$/.test(download.suggestedFilename())) throw new Error(download.suggestedFilename());
});
let machine;
await step("WhatsApp group: only admin groups can be chosen; new members are added, backdated ones are not", async () => {
  await page.goto(`${BASE}/whatsapp`);
  await page.getByRole("button", { name: "Choose group" }).click();
  const select = page.locator("#wa-group"); await select.waitFor();
  if ((await select.locator("option", { hasText: "Family chat" }).getAttribute("disabled")) === null) throw new Error("a group where the number is not admin can be chosen");
  await select.selectOption({ label: "Test Gym Members (42 people)" });
  await page.getByRole("button", { name: "Save group" }).click(); await toast(page, "New members will be added to Test Gym Members");
  await page.goto(`${BASE}/members/new`);
  await page.getByPlaceholder("Name", { exact: true }).fill("Group Joiner"); await page.getByPlaceholder("Phone", { exact: true }).fill("9876522299");
  await pickDate(page); await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/sales\/new\?member=/, { timeout: 20000 });
  await page.goto(`${BASE}/whatsapp?tab=log`);
  await page.locator("div.rounded-lg.border", { hasText: "Group Joiner" }).filter({ hasText: "WhatsApp group" }).filter({ hasText: "{group_link}" }).first().waitFor();
  if (await page.locator("div.rounded-lg.border", { hasText: "old expired" }).filter({ hasText: "WhatsApp group" }).count()) throw new Error("a backdated member was added to the group");
});
await step("Add to WhatsApp group button on a member's profile", async () => {
  await page.goto(`${BASE}/members`); await page.locator("tr", { hasText: "old expired" }).getByText("old expired").click();
  await page.getByRole("button", { name: "Add to WhatsApp group" }).click(); await toast(page, "will be added to the group");
  await page.goto(`${BASE}/whatsapp?tab=log`);
  await page.locator("div.rounded-lg.border", { hasText: "old expired" }).filter({ hasText: "WhatsApp group" }).first().waitFor();
});
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
