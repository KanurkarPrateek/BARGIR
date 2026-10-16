# Testing

Two kinds of testing:

1. **Automated browser tests** — run with one command before every release.
2. **Manual checklist** — for a person to walk through, especially on a new
   deployment, with a real WhatsApp number and a real biometric machine.

---

## 1. Automated browser tests

```bash
npm run test:e2e            # all suites, ~5 minutes
HEADED=1 npm run test:e2e   # watch the browser while it runs
```

Needs the local Postgres container (`docker start gym-management-db`) and
Google Chrome. The runner (`tests/run-e2e.sh`):

- creates a **separate** database `gym_e2e` and a production build of the app on port 3100,
- uses a **stand-in WhatsApp sender** and a **stand-in email service**, so no real
  message or email can be sent,
- runs six suites in order (the last one also builds and starts the Control Panel on port 3500) and prints ✓ / ✗ per step,
- saves a screenshot of every failed step in `tests/e2e/screenshots/`.

| Suite | What it proves |
|---|---|
| `multi-gym` (19) | Admin creates gyms; one phone = one login; each gym sees only its own members, packages, sales, payments and machines; machines are routed by serial number; invoices and PDFs open only for their own gym (not signed out, not another gym; the sender with its key); invoices show the right gym's details; switched-off gyms cannot sign in |
| `onboarding` (12) | Self sign-up and duplicate phone refused, all six wizard steps, Excel import with per-row problem report (bad phone, unknown package), running memberships and payments imported with no messages, duplicate import skipped, tap-to-claim machine, setup reminder on the dashboard |
| `daily-flows` (19) | Packages, trainers (phone validation), enquiry → member → subscription → part payment → collect, enquiry marked Joined, Payment Report, PT clients, check-in, WhatsApp welcome/invoice/receipt queued, workflows, offers, invoice page and PDF, no invoice links in messages, Send on View Subscriptions sends the PDF, every page opens, removed pages are gone |
| `features` (24) | Universal Search, batches, BackDate member/subscription/enquiry/payment with **no** messages, InActive / Pending Renewal / Dormant lists, staff and staff login, Staff Attendance, expenses and profit, biometric Add → punch → attendance, Block → machine refuses, Unblock, Delete, auto-block switch, BlackList refusing check-in |
| `control` (14) | Control Panel against the test app: wrong cluster key reported, cluster health and settings to paste, new gym created on the cluster with a working owner login, duplicate owner phone refused, payment moves the renewal and books 10% commission, suspend blocks sign-in and resume restores it, owner password reset, linking a gym that signed itself up, MRR and capacity, a salesperson sees only their own gyms, commission payout |
| `front-desk` (6) | Staff login hides monthly revenue and owner menus, owner pages redirect, desk work still works, removing the login locks them out |

---

## 2. Manual checklist

Use a **test gym** created under the admin's Gyms page. Use **your own mobile
number** for every member, enquiry, trainer and staff member you create, so any
WhatsApp message reaches you and nobody else.

Tick each line. *Expected* is what should happen.

### Onboarding a new gym

| # | Do | Expected |
|---|---|---|
| O1 | `/signup` with a new phone number | Account created; setup wizard, step 1 of 6 |
| O2 | `/signup` again with the same phone | "This phone number already has an account" |
| O3 | Wizard steps 1–3 with the defaults | Packages and batches appear under Package Management and View Batch |
| O4 | Step 4: download the template, fill 3 rows (one with a bad phone), upload | 2 imported; the bad row listed with its row number |
| O5 | Step 6: set the machine's server address, wait | Its serial appears; **This is my machine** adds it |
| O6 | Finish setup | Dashboard, no setup reminder |

### Sign-in and roles

| # | Do | Expected |
|---|---|---|
| A1 | Sign in at `/signin` with a wrong password | "Wrong phone number or password" |
| A2 | Sign in as the admin login | Gyms page |
| A3 | Add gym, then sign in as its owner | Dashboard with the gym's name in the sidebar |
| A4 | As owner, open `/admin/gyms` | Sent back to sign-in |
| A5 | Staff Management → Add Staff → Give login; sign in as that staff member | Dashboard without "Collected this month"; no Expense/Staff/Package/WhatsApp/Settings menus |
| A6 | As staff, open `/payments` | Sent back to the dashboard |
| A7 | As owner, Remove login; try signing in as staff | Refused |

### Setup

| # | Do | Expected |
|---|---|---|
| B1 | Gym Settings: logo, address, GST, terms → Save | Logo in the sidebar |
| B2 | Add Package (Monthly ₹1000, 1 month) and a PT package with the switch on | Both in View Package; PT switch on |
| B3 | Add a trainer with `12345` as phone | "Enter a valid 10-digit Indian mobile number" |
| B4 | Add a batch Morning 06:00–08:00 | Shows in View Batch |

### Enquiry → member → subscription → payment

| # | Do | Expected |
|---|---|---|
| C1 | Add Enquiry, assign a trainer | Saved; welcome message *Waiting*/*Sent* in WhatsApp → Sent messages; trainer message too |
| C2 | View Enquiry → Make member | Name and phone pre-filled |
| C3 | Save the member | Lands on Add Subscription with the member selected |
| C4 | Pick Monthly, pay ₹400 by cash → Create | Member profile shows ₹600 due; "Invoice sent on WhatsApp" |
| C5 | Collect ₹600 by UPI | Due becomes ₹0; Payments tab shows 2 payments; receipt message queued |
| C6 | View Enquiry | The enquiry is under Joined |
| C7 | Payment Report → Today | Cash ₹400, UPI ₹600 |
| C8 | View Subscriptions → delete that sale | Refused: payments exist |
| C9 | Open the invoice page signed in, then the same address signed out | Signed in: gym logo, address and GST printed. Signed out: sent to sign-in |
| C10 | Download PDF on the invoice (or PDF on the member profile) | A one-page PDF with ₹ amounts, payments received, and PAID when nothing is due |
| C11 | Gym Settings → Choose image (a coloured logo) → Save; open an invoice and its PDF | Header band, table header and Balance Due in the logo's colour; text readable on it |

### Member lists and search

| # | Do | Expected |
|---|---|---|
| D1 | Type part of a phone number in Universal Search | The member appears; Enter opens them |
| D2 | View Member → InActive / Pending Renewal / Dormant / With dues | Each list matches its description at the top of the page |
| D3 | Member profile → BlackList (give a reason) | Red BlackList notice; listed under BlackList Member |
| D4 | Member Attendance → check in that member | Refused with the reason |
| D5 | Remove from BlackList, check in | Works |

### Sales Analytics

| # | Do | Expected |
|---|---|---|
| S1 | Sales Analytics → This month | Sales value equals the sum of this month's subscriptions (after discount) in View Subscriptions |
| S2 | Compare Collected with Payment Report for the same dates | Same amount |
| S3 | Hover a month in the chart; Show as table | Amounts match |
| S4 | Download Excel | One row per subscription in the period |
| S5 | Sign in as front desk, open `/analytics` | Sent back to the dashboard |

### WhatsApp group

| # | Do | Expected |
|---|---|---|
| WG1 | In WhatsApp, make the gym's number admin of a test group with only you in it; WhatsApp Management → Choose group | The group is listed; groups where the number is not admin are greyed out |
| WG2 | Save with **Add new members automatically**, add a member with your second number | That number is added to the group (or gets the invite link) |
| WG3 | BackDate Add Member | Not added |
| WG4 | Member profile → Add to WhatsApp group | Added; Sent messages shows the result |

### Staff and expenses

| # | Do | Expected |
|---|---|---|
| E1 | Staff Attendance → Mark in, then Mark out | Times shown; history lists the day; "Late" if after shift start + 5 min |
| E2 | Add Expense: Rent ₹5000 | Shows in View Expense; Profit this month drops by ₹5000 |

### BackDate Management

| # | Do | Expected |
|---|---|---|
| F1 | BackDate Add Member → save | Goes to BackDate Renew Subscription; yellow banner |
| F2 | Start date 3 months ago, paid in full → Create | "Old record: no invoice sent."; member is InActive |
| F3 | Back Date Add Enquiry with a past date | Saved; **no** welcome message |
| F4 | BackDate Others → Record old payment with a past date | Saved; **no** receipt |
| F5 | WhatsApp → Sent messages | Nothing for F1–F4 |

### WhatsApp automation

Link **a test number** first (WhatsApp Management → scan). Everything below
uses your own number as the member's number.

| # | Do | Expected on the phone |
|---|---|---|
| W1 | WhatsApp Management → Send test to your number | "Test message from your gym software ✅" |
| W2 | Add Enquiry | Welcome message with your gym's name |
| W3 | Add Subscription with part payment | The invoice PDF, with plan, paid and balance as its caption; no link |
| W4 | Collect the balance | Receipt message |
| W5 | Add Subscription whose end date is 3 days away (BackDate Renew Subscription with the right start date), then Workflows → **Run now** | "…ends on <date>" reminder (runs only 9 AM–9 PM) |
| W6 | Same with an end date of yesterday → Run now | "…ended on <date>" message |
| W7 | Member with today's birthday → Run now | Birthday wish |
| W8 | Run now again | Nothing new (each reminder is sent once) |
| W9 | Switch off a workflow, repeat its trigger | Nothing sent |
| W10 | Offers → send to "All members" | Each test member gets it with their own name; Past offers shows sent count |
| W10a | Package Management → Edit a package: 10% off → **Send offer** | Offers opens with a ready message showing the real offer price; each person gets it by name |
| W10b | Pending Payments → send button | Payment reminder arrives from the gym's number; no WhatsApp window opens on the computer |
| W11 | Add a member with a number that has no WhatsApp, sell a package | Sent messages: *Failed — This number is not on WhatsApp* |
| W12 | Unlink, add an enquiry | Message stays *Waiting*; red banner on every page |
| W13 | Link again | The waiting message is delivered |
| W14 | Settings email + RESEND configured; member with email; sell a package | Invoice email arrives, replies go to the gym's email |

### Biometric

With the simulator (`npm run simulate:biometric -- --server <url> --serial TEST-001 --heartbeat 5`) or a real machine:

| # | Do | Expected |
|---|---|---|
| G1 | Machine Setup → Add machine with its serial | *Connected* within a minute |
| G2 | Add Biometric → Enroll a member | Toast with the machine ID; View Commands → *Done*; real machine: name appears under that ID |
| G3 | Enroll the finger on the machine, punch | Member appears in today's Member Attendance |
| G4 | Block Biometric → Block | View Commands *Done*; the machine no longer recognises them |
| G5 | Unblock | Back on the machine (enroll the finger again) |
| G6 | Delete Biometric → Delete | Removed; ID freed |
| G7 | Add staff to the machine, punch twice 5+ minutes apart | Staff Attendance shows in and out |
| G8 | Turn on auto-block; a member's membership ends | They are removed from the machine within ~5 minutes |
| G9 | Unregistered machine sends punches | Refused; punches kept on the machine until added |
| G10 | Pen drive: import the machine's attendance .dat file | Punches read, attendance marked |

---

## When something fails

- Automated tests: open the screenshot named after the failed step in
  `tests/e2e/screenshots/`, and the app log at `/tmp/gym-e2e-app.log`.
- WhatsApp: WhatsApp Management → Sent messages shows the reason for each failure.
- Biometric: View Commands shows the machine's return code for failed instructions.
