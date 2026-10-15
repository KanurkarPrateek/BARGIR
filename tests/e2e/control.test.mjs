// Control Panel (control/) against the test copy of the gym app: clusters,
// creating and linking gyms through the platform API, billing, commission,
// suspending, and what a salesperson can see.
import { startBrowser, signIn, BASE } from "./lib.mjs";

const CONTROL = process.env.CONTROL_BASE ?? "http://localhost:3500";
const ADMIN = { email: process.env.CONTROL_ADMIN_EMAIL, password: process.env.CONTROL_ADMIN_PASSWORD };
const KEY = process.env.PLATFORM_API_KEY;
const { page, step, finish } = await startBrowser("control");
console.log("Control Panel");

async function controlSignIn(email, password) {
  await page.context().clearCookies();
  await page.goto(`${CONTROL}/signin`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
const field = (label) => page.locator("div.space-y-1", { has: page.locator("label", { hasText: new RegExp(`^${label}$`) }) }).locator("input, select, textarea").first();
const ok = (text) => page.getByRole("status").filter({ hasText: text }).waitFor();
const error = (text) => page.getByRole("alert").filter({ hasText: text }).waitFor();
let gymUrl, ownerPassword, salesPassword;

await step("wrong password is refused; the first sign-in creates the admin", async () => {
  await controlSignIn(ADMIN.email, "not-the-password"); await error("Wrong email or password");
  await controlSignIn(ADMIN.email, ADMIN.password); await page.getByText("Business overview").waitFor();
});
await step("a cluster with a wrong key shows the problem", async () => {
  await page.goto(`${CONTROL}/clusters/new`);
  await field("Name").fill("bad-key"); await field("App address \\(Vercel\\)").fill(BASE);
  await field("PLATFORM_API_KEY").fill("x".repeat(32));
  await page.getByRole("button", { name: "Save cluster" }).click();
  await page.getByText("refused the API key").first().waitFor();
});
await step("add the cluster: health OK and its existing gyms listed to link", async () => {
  await page.goto(`${CONTROL}/clusters/new`);
  if ((await field("SESSION_SECRET").inputValue()).length < 32) throw new Error("secrets not generated");
  await field("Name").fill("cluster-1"); await field("App address \\(Vercel\\)").fill(BASE); await field("Gyms it can hold").fill("3");
  await field("PLATFORM_API_KEY").fill(KEY);
  await field("Vercel account \\(email\\)").fill("cluster1@example.com");
  await page.getByRole("button", { name: "Save cluster" }).click();
  await ok("Cluster saved");
  await page.getByText("Database").first().waitFor();
  await page.locator("td", { hasText: "Alpha Fitness" }).getByText("Not in the Control Panel").waitFor();
  await page.getByRole("button", { name: "Copy Vercel settings" }).waitFor();
  const pre = await page.locator("pre").first().textContent();
  if (!pre.includes(`PLATFORM_API_KEY=${KEY}`) || !pre.includes("ALLOW_SIGNUP=false")) throw new Error("Vercel settings incomplete");
});
await step("add a salesperson with 10% commission", async () => {
  await page.goto(`${CONTROL}/team`);
  await field("Name").fill("Ravi Sales"); await field("Email").fill("ravi@example.com");
  salesPassword = await field("Password").inputValue();
  await page.getByRole("button", { name: "Add" }).click(); await ok("Ravi Sales added");
});
await step("create a gym: it is made on the cluster with its owner login", async () => {
  await page.goto(`${CONTROL}/gyms/new`);
  await field("Gym name").fill("Control Gym"); await field("City").fill("Pune");
  await field("Owner name").fill("Kiran Owner"); await field("Owner mobile").fill("9811100099");
  ownerPassword = await field("Owner password").inputValue();
  await field("Price per plan \\(₹\\)").fill("1000");
  await field("Sold by").selectOption({ label: "Ravi Sales (10%)" });
  await page.getByRole("button", { name: "Create gym" }).click();
  await ok("Gym created on cluster-1"); gymUrl = page.url().split("?")[0];
  await page.locator("pre", { hasText: `Password: ${ownerPassword}` }).waitFor();
  await page.getByText("0 active of 0").waitFor();
});
await step("the new owner signs in to the gym app", async () => {
  await signIn(page, "9811100099", ownerPassword); await page.waitForURL(/setup|dashboard/);
});
await step("the same owner phone cannot be used twice", async () => {
  await controlSignIn(ADMIN.email, ADMIN.password); await page.waitForURL(CONTROL + "/");
  await page.goto(`${CONTROL}/gyms/new`);
  await field("Gym name").fill("Copy Gym"); await field("Owner name").fill("Someone"); await field("Owner mobile").fill("9811100099");
  await page.getByRole("button", { name: "Create gym" }).click(); await error("already has a login");
});
await step("record a payment: renewal moves on and 10% commission is due", async () => {
  await page.goto(gymUrl);
  await page.getByRole("button", { name: "Record payment" }).click(); await ok("next renewal moved");
  await page.locator("td", { hasText: "₹100" }).first().waitFor();
  await page.goto(`${CONTROL}/team`);
  await page.locator("tr", { hasText: "Ravi Sales" }).locator("td").last().filter({ hasText: "₹100" }).waitFor();
});
await step("suspend: the gym cannot sign in; resume: it can", async () => {
  await page.goto(gymUrl);
  await page.getByRole("button", { name: "Suspend" }).click(); await ok("Gym suspended");
  await signIn(page, "9811100099", ownerPassword); await page.getByText("switched off").first().waitFor();
  await controlSignIn(ADMIN.email, ADMIN.password); await page.waitForURL(CONTROL + "/");
  await page.goto(gymUrl); await page.getByRole("button", { name: "Resume" }).click(); await ok("Gym is active");
  await signIn(page, "9811100099", ownerPassword); await page.waitForURL(/setup|dashboard/);
});
await step("reset the owner's password", async () => {
  await controlSignIn(ADMIN.email, ADMIN.password); await page.waitForURL(CONTROL + "/");
  await page.goto(gymUrl); await field("Set a new owner password").fill("new-pass-12345");
  await page.getByRole("button", { name: "Reset password" }).click(); await ok("Owner password changed");
  await signIn(page, "9811100099", "new-pass-12345"); await page.waitForURL(/setup|dashboard/);
});
await step("link a gym that already existed on the cluster", async () => {
  await controlSignIn(ADMIN.email, ADMIN.password); await page.waitForURL(CONTROL + "/");
  await page.goto(`${CONTROL}/clusters`); await page.getByRole("link", { name: "cluster-1" }).click();
  await page.locator("tr", { hasText: "Alpha Fitness" }).getByRole("link", { name: "Link" }).click();
  await page.getByText("Link an existing gym").waitFor();
  await page.getByRole("button", { name: "Link gym" }).click(); await ok("Gym linked");
  await page.getByText(/active of \d+/).waitFor();
});
await step("dashboard: MRR, gyms and cluster capacity", async () => {
  await page.goto(`${CONTROL}/`);
  await page.locator("div", { hasText: /^Monthly recurring revenue₹1,000/ }).first().waitFor();
  await page.getByText("2 / 3").waitFor();
});
await step("a salesperson sees only their gyms and commission", async () => {
  await controlSignIn("ravi@example.com", salesPassword); await page.getByText("Hello, Ravi Sales").waitFor();
  await page.goto(`${CONTROL}/gyms`); await page.getByText("Control Gym").waitFor();
  if (await page.getByText("Alpha Fitness").count()) throw new Error("sees another gym");
  await page.goto(`${CONTROL}/clusters`); await page.waitForURL(CONTROL + "/");
  await page.goto(`${CONTROL}/commission`); await page.locator("div", { hasText: /^Owed now₹100$/ }).first().waitFor();
});
await step("paying out the commission clears what is owed", async () => {
  await controlSignIn(ADMIN.email, ADMIN.password); await page.waitForURL(CONTROL + "/");
  await page.goto(`${CONTROL}/team`); await page.getByRole("link", { name: "Ravi Sales" }).click();
  await page.getByRole("button", { name: "Record payout" }).click(); await ok("payout recorded");
  await page.locator("div", { hasText: /^Owed now₹0$/ }).first().waitFor();
});

process.exit(await finish());
