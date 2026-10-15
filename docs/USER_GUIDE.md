# User Guide

How to run a gym with this software, written for the gym owner and the
front-desk team. Menu names match the left sidebar.

- [Who can do what](#who-can-do-what)
- [Getting started (about 5 minutes)](#getting-started-about-5-minutes)
- [First day: set up your gym](#first-day-set-up-your-gym)
- [Every day at the front desk](#every-day-at-the-front-desk)
- [Sales Analytics](#sales-analytics)
- [Universal Search Member](#universal-search-member)
- [Attendance Management](#attendance-management)
- [Member Management](#member-management)
- [Enquiry Management](#enquiry-management)
- [Subscription Management](#subscription-management)
- [Package Management](#package-management)
- [Trainer Management](#trainer-management)
- [BackDate Management](#backdate-management)
- [Expense Management](#expense-management)
- [WhatsApp Management](#whatsapp-management)
- [Staff Management](#staff-management)
- [Biometric Management](#biometric-management)
- [Gym Settings](#gym-settings)
- [Words used in this app](#words-used-in-this-app)

---

## Who can do what

| | Gym owner | Front-desk staff login |
|---|---|---|
| Members, enquiries, subscriptions, attendance | ✓ | ✓ |
| Collect payments, send invoices | ✓ | ✓ |
| Enroll members on the biometric machine | ✓ | ✓ |
| Dashboard | ✓ | ✓ (without monthly revenue) |
| Sales Analytics, Payment Report, Expense Management | ✓ | — |
| Package, Trainer and Staff Management | ✓ | — |
| WhatsApp Management, Gym Settings, Machine Setup | ✓ | — |
| BlackList a member, delete a sale or payment | ✓ | — |

The **platform admin** (whoever runs this software for many gyms) signs in
with the admin login, creates each gym under **Gyms**, and can open any gym to
help with setup.

---

## Getting started (about 5 minutes)

1. Open the app's address and click **Start here** (or go to `/signup`). Enter your
   gym's name, your name, your mobile number and a password.
2. The **setup wizard** opens. Six short steps, each one skippable:

| Step | What you do |
|---|---|
| 1. Your gym | Address, contact number, GST number |
| 2. Packages | Tick the plans you sell and type your prices (Monthly, Quarterly, Half Yearly, Yearly, Personal Training) |
| 3. Batches | Tick your time slots and adjust the times |
| 4. Members | Upload your member list from **Excel or CSV**. Only Name and Phone are needed; add Package, Start date and Paid to bring in running memberships. **Download template** shows the format. Nobody is messaged. |
| 5. WhatsApp | Scan the QR code with the gym's phone |
| 6. Biometric | Type the address shown into the machine; when it connects, tap **This is my machine** (check the serial matches the sticker) |

3. **Finish setup** takes you to the dashboard. Until you finish, a blue
   *Finish setting up your gym* card on the dashboard brings you back, and the
   wizard is always under **Settings → Setup Wizard**.

Your member register can also be imported later from **Member Management →
Import Members**. Rows with a problem (wrong phone number, unknown package,
already a member) are listed with their row number so you can fix and re-upload
just those.

---

## First day: set up your gym

The wizard covers most of this. To do it by hand instead:

Do these once, in this order. Each takes a minute or two.

1. **Sign in** at `/signin` with the phone number and password the platform admin gave you.
2. **Gym Settings** → add your logo, address, contact number, GST number and invoice terms.
   These print on every invoice and appear in WhatsApp messages.
3. **Package Management → Add Package** → one entry per plan you sell
   (name, price, months). Switch on *Personal training package* for PT plans.
4. **Trainer Management** → add your trainers with their WhatsApp numbers.
5. **Member Management → View Batch** → add your time slots (e.g. Morning 06:00–08:00).
6. **WhatsApp Management** → scan the QR code with the gym's phone
   (WhatsApp → Settings → Linked devices → Link a device).
7. **Biometric Management → Machine Setup** → type the address shown into the
   machine, then add the machine's serial number. See [Biometric Management](#biometric-management).
8. **Staff Management → Add Staff** → add your team; *Give login* to front-desk staff.
9. **Moving from another software?** Use [BackDate Management](#backdate-management)
   to enter existing members and their running subscriptions without messaging anyone.

---

## Every day at the front desk

| When | What to do | Where |
|---|---|---|
| Opening | Look at **Expiring this week** and **Expired, not renewed** | Dashboard |
| Someone walks in to ask | Add them as an enquiry | Enquiry Management → Add Enquiry |
| Someone joins | *Make member* on their enquiry, then pick the package and take the payment | Enquiry Management → View Enquiry |
| Someone renews | Open them → **Renew / new sale** | Universal Search → their profile |
| Someone pays a balance | Open them → **Collect** on the plan | their profile, or Subscription Management → Pending Payments |
| Member arrives (no machine) | Pick them → **Check In** | Attendance Management → Member Attendance |
| Staff arrive / leave | **Mark in** / **Mark out** | Attendance Management → Staff Attendance |
| Follow-ups | Call the people listed | Enquiry Management → Today's Follow-ups, Member Management → Dormant Member |
| Closing | Count the cash drawer against today's cash total | Expense Management → Payment Report (owner) |

WhatsApp welcome messages, invoices, receipts, renewal reminders and birthday
wishes go out by themselves once WhatsApp is connected. The send buttons on
Pending Payments, View Subscriptions, Renewal Follow-ups and Birthdays send the
message straight from the gym's WhatsApp too; nothing opens on the computer.

---

## Sales Analytics

*(owner)* How the business is doing, for any period (this month, last month,
last 3 months, this year, or your own dates):

- **Headline numbers:** sales value, money collected, new members and renewals,
  renewal rate (of memberships that ended, how many renewed), average sale,
  discounts given, outstanding dues, enquiry conversion.
- **Sold vs collected** for each of the last 12 months (hover for amounts, or
  *Show as table*).
- **Sales by package:** value and count sold, share of sales, discount given,
  and how many members are on each package right now.
- **Collected by payment mode**, **new vs renewal**, **enquiries by source**
  with conversion, and **sales by trainer**.
- **Download Excel** gives every subscription in the period, one row each.

Subscriptions count on their start date; money counts on the day it was received.

---

## Universal Search Member

The search box at the top of every page. Type a name, part of a phone number,
member ID (MEM…) or machine ID, then click the result or press **Enter**.
Press **/** anywhere to jump into the box. It also finds enquiries, staff and
trainers. A red badge shows **BlackList** or **Expired** members at a glance.

---

## Attendance Management

**Member Attendance** — pick the member, press **Check In**. Members whose
plan has expired, or who never bought one, show a red badge in today's list.
BlackList members are refused with the reason.

**Staff Attendance** — one tap marks a staff member in, a second tap marks
them out. The history shows anyone more than 5 minutes late for their shift.
Staff enrolled on the biometric machine are marked automatically (first
punch = in, last punch = out).

**View Attendance** — attendance on any past date.

---

## Member Management

**Add Member** — name, mobile number (Indian 10-digit; `+91 98765 43210`
also works), gender, date of birth, joining date, batch and trainer. Saving
takes you straight to the subscription form, because joining nearly always
means buying a package.

**View Member** — everyone, with package, membership end date, last visit,
dues and batch. Click a row to open the member. The buttons along the top
switch between lists:

| List | Who is in it |
|---|---|
| All | Everyone |
| Active | Membership running today |
| Pending Renewal | Ending within 7 days, or ended in the last 30 days |
| InActive Member | No running membership (expired, or never bought) |
| Dormant Member | Membership running but not seen for 7+ days |
| BlackList Member | Refused at check-in, kept off the biometric machine |
| With dues | Owe money |

Each row has a **call** button, the member's **biometric** status (or an
**Enroll** button) and the Google-**review** tick.

**Member profile** — everything about one member: membership and days left,
dues, total paid, visits, trainer, batch, biometric status, all plans with
**Collect**, **Invoice** and **Send invoice**, full payment history, and
attendance. **BlackList** (owner) asks for a reason, refuses check-in and
removes them from the machine.

**View Batch** — add, edit or delete time slots and see how many members are
in each. Members can then be filtered by batch in View Member.

**Birthdays** — today's birthdays with a WhatsApp wish button.

---

## Enquiry Management

**Add Enquiry** — name, number, follow-up date, note, how they heard of you,
and the trainer who should follow up. Saving sends the person a welcome
message on WhatsApp and tells the trainer.

**View Enquiry** — leads grouped as *To follow up*, *Joined*, *Lost*. Change the
status (Open → Trial → Joined / Lost) or the trainer right in the list.
**Make member** turns the enquiry into a member with everything pre-filled.

**Today's Follow-ups** — enquiries due for a follow-up on a chosen day.

---

## Subscription Management

**Add Subscription** — pick the member and the package; the price, end date
and balance are worked out for you. Enter what was paid now (0 if paying
later) and how (cash, UPI, card, bank transfer). For PT packages, pick the
trainer. After saving, the invoice goes to the member on WhatsApp (and email,
if they have one).

**View Subscriptions** — every sale. A sale with payments on it cannot be
deleted until the payments are removed from the member's Payments tab.

**View Pending Renewal** — same as the Pending Renewal list in View Member.

**Pending Payments** — every open balance, with **Collect**.

**Renewal Follow-ups** — expiring and expired memberships with ready-made
WhatsApp reminders you can send by hand.

---

## Package Management

*(owner)* **Add Package** / **View Package** — name, price, duration in
months, and whether it is a personal training package.

- **Offers:** give a package *% off* or *₹ off*, optionally until a date. View
  Package shows the old and the offer price. The offer is filled in
  automatically when the package is sold (staff can still change it), and ends
  by itself after the last date.
- **Send offer** on a package opens WhatsApp Management → Offers with a ready
  message (package, price, offer price, valid till), sent to each person by name.
- **Edit** changes a package for new sales; existing subscriptions keep their price.

---

## Trainer Management

*(owner)* Add trainers with their WhatsApp numbers. The **PT clients** tab
lists everyone on a personal training package and who trains them; assign a
trainer from the list. A trainer's page shows their members, open enquiries
and this month's PT sales. Trainers get WhatsApp messages when a member or
enquiry is assigned to them and a daily list of follow-ups.

---

## BackDate Management

For entering records that happened **before** you started using this
software, typically when moving a gym over from paper or another app. A yellow
**BackDate entry** banner shows on these forms. **Nothing is sent to anyone**
for backdated records: no welcome, invoice, receipt or email.

| Menu | Use it for |
|---|---|
| BackDate Add Member | An existing member; continue to their current subscription |
| BackDate Renew Subscription | A subscription that started in the past; pick the real start date and the date the money was received |
| Back Date Add Enquiry | An old enquiry, with its real date |
| BackDate Others | Old payments against balances, with the real date |

---

## Expense Management

*(owner)* **Add Expense** — what for (Rent, Salary, Electricity…), amount,
date and how it was paid. **View Expense** lists a date range with totals per
category. The top cards and **Profit by month** show *collected − spent*.
**Payment Report** lists every payment received, with totals per payment mode,
for tallying the cash drawer.

---

## WhatsApp Management

*(owner)* Messages are sent from the gym's own WhatsApp number after you link
it by scanning the QR code once. A red **WhatsApp is not connected — Scan Now**
banner appears at the top of every page while it is not linked.

- **Workflows** — automatic messages: welcome for new enquiries, enquiry
  follow-ups, membership expiry reminders, birthday wishes, invoice when a
  package is sold, receipt when a payment is collected. Edit the wording,
  switch any off, or add your own.
- **Offers** — write one message, choose who gets it (active members,
  inactive members, all members, enquiries, everyone), and each person gets it
  with their own name.
- **Sent messages** — every message with its status: *Sent*, *Waiting* or
  *Failed* (with the reason), and **Retry failed**.

Details and safe testing: [WHATSAPP.md](WHATSAPP.md).

---

## Staff Management

*(owner)* **Add Staff** — name, mobile, role, shift times, monthly salary,
joining date. **Give login** lets a front-desk person sign in with their own
phone number and password; see [Who can do what](#who-can-do-what). Marking
someone as no longer working here removes their login.

---

## Biometric Management

Works with eSSL, ZKTeco and BioMax "push" machines.

| Tab | What it does |
|---|---|
| **Add Biometric** | Sends a member (or staff member) to the machine with a machine ID. Then enroll their finger **on the machine**: User Management → find the ID → enroll fingerprint. *Get people from machine* imports a machine that already has people on it. |
| **Block Biometric** | Takes a member off the machine so it stops recognising them. Optional: block automatically when membership ends, and put them back when they renew. |
| **Delete Biometric** | Removes someone from the machine and frees their machine ID. |
| **Link IDs** | Machine IDs that punched but aren't linked to anyone yet. Pick the member or staff member once. |
| **View Commands** | Every instruction sent to the machines and whether it worked. |
| **Machine Setup** *(owner)* | The address to type into the machine, adding machines by serial number, and importing a pen-drive attendance file. |

Block removes the fingerprint from the machine, so an unblocked member has to
enroll the finger again. Details: [BIOMETRIC.md](BIOMETRIC.md).

---

## Gym Settings

*(owner)* Logo, gym name, address, contact number, email, GST number and
invoice terms. Change your own password at the bottom.

---

## Words used in this app

| Word | Means |
|---|---|
| Package | A plan you sell (Monthly, Quarterly, PT…) |
| Subscription | One package sold to one member, with start and end dates |
| Due / balance | Money still owed on a subscription |
| Active | Membership running today |
| InActive | No running membership |
| Dormant | Paying, but not coming |
| Pending Renewal | Ending soon or recently ended |
| BlackList | Not allowed in |
| Batch | Workout time slot |
| Machine ID | The number a person is stored under on the biometric machine |
| BackDate | An old record entered later, with nothing sent to anyone |
