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
- runs four suites in order and prints ✓ / ✗ per step,
- saves a screenshot of every failed step in `tests/e2e/screenshots/`.

| Suite | What it proves |
|---|---|
| `multi-gym` (17) | Admin creates gyms; one phone = one login; each gym sees only its own members, packages, sales, payments and machines; machines are routed by serial number; public invoices show the right gym; switched-off gyms cannot sign in |
| `daily-flows` (16) | Packages, trainers (phone validation), enquiry → member → subscription → part payment → collect, enquiry marked Joined, Payment Report, PT clients, check-in, WhatsApp welcome/invoice/receipt queued, workflows, offers, invoice page, every page opens, removed pages are gone |
| `features` (18) | Universal Search, batches, BackDate member/subscription/enquiry/payment with **no** messages, InActive / Pending Renewal / Dormant lists, staff and staff login, Staff Attendance, expenses and profit, biometric Add → punch → attendance, Block → machine refuses, Unblock, Delete, auto-block switch, BlackList refusing check-in |
| `front-desk` (6) | Staff login hides monthly revenue and owner menus, owner pages redirect, desk work still works, removing the login locks them out |

---

## 2. Manual checklist

Use a **test gym** created under the admin's Gyms page. Use **your own mobile
number** for every member, enquiry, trainer and staff member you create, so any
WhatsApp message reaches you and nobody else.

Tick each line. *Expected* is what should happen.

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
| C9 | Open the invoice link signed out | Gym logo, address and GST printed |

### Member lists and search

| # | Do | Expected |
|---|---|---|
| D1 | Type part of a phone number in Universal Search | The member appears; Enter opens them |
| D2 | View Member → InActive / Pending Renewal / Dormant / With dues | Each list matches its description at the top of the page |
| D3 | Member profile → BlackList (give a reason) | Red BlackList notice; listed under BlackList Member |
| D4 | Member Attendance → check in that member | Refused with the reason |
| D5 | Remove from BlackList, check in | Works |

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
| W3 | Add Subscription with part payment | Invoice message with plan, paid, balance, link |
| W4 | Collect the balance | Receipt message |
| W5 | Add Subscription whose end date is 3 days away (BackDate Renew Subscription with the right start date), then Workflows → **Run now** | "…ends on <date>" reminder (runs only 9 AM–9 PM) |
| W6 | Same with an end date of yesterday → Run now | "…ended on <date>" message |
| W7 | Member with today's birthday → Run now | Birthday wish |
| W8 | Run now again | Nothing new (each reminder is sent once) |
| W9 | Switch off a workflow, repeat its trigger | Nothing sent |
| W10 | Offers → send to "All members" | Each test member gets it with their own name; Past offers shows sent count |
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
