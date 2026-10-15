# WhatsApp automation

How the automatic WhatsApp messages work, how to set them up, and how to test
them without messaging real members by mistake.

## How it works

```
 App (Vercel)                 Database                 WhatsApp sender (Render)
 ─────────────                ────────                 ────────────────────────
 an event happens   ──────►   WhatsappMessage row  ◄── picks up "pending" rows
 (new enquiry, sale,          status = pending          sends from the gym's number
  payment, reminder due)                                marks sent / failed
```

- The **app** never talks to WhatsApp. It writes a row per message.
- The **sender** (`worker/`) keeps each gym's number linked and delivers rows
  one at a time, 3–6 seconds apart per number, so it does not look like spam.
- Every 5 minutes the sender calls `/api/cron/tick`, which queues reminders that
  have become due (expiry, follow-ups, birthdays). Vercel also calls it once a day
  at 10 AM as a safety net.
- Dated reminders go out only between **9 AM and 9 PM India time**. If the
  server was off, it catches up on the last 2 days.
- A message that could not go out within **24 hours** (number not linked) is
  marked *Failed* instead of arriving late.
- Each reminder is sent **once per person per event**, even if the timer runs
  many times.

## What is sent, and when

| Workflow | When | Sent to |
|---|---|---|
| Welcome a new enquiry | Right after an enquiry is added | The enquiry |
| Enquiry follow-up | On the follow-up date (not on the day the enquiry was added) | Open and Trial enquiries |
| Membership expiring in 3 days | 3 days before the end date | Members who have not renewed |
| Membership expired | 1 day after the end date | Members who have not renewed |
| Birthday wish | On the birthday | Members |
| Invoice when a plan is sold | Right after a subscription is added | The member |
| Receipt when a payment is collected | Right after a balance payment dated today | The member |

The invoice and receipt messages arrive with the **invoice as a PDF** attached
(the message text is its caption). If the PDF cannot be fetched, the text still
goes, with the invoice link.

Trainers additionally get: a message when an enquiry or member is assigned to
them, and one daily list of the enquiries they must follow up.

**Sent by staff with one tap:** the send buttons on Pending Payments (payment
reminder), View Subscriptions (invoice link), Renewal Follow-ups and Birthdays go
through the same queue from the gym's number; no WhatsApp window opens.

**Offer audiences:** active members, pending renewal (ending soon or ended in the
last 30 days), dormant members, members without an active membership, all
members, enquiries, everyone. BlackList members never get offers.

**Never sent:** anything for BackDate entries, payments dated in the past,
enquiries marked Joined or Lost, or offers to enquiries marked Lost.

Every workflow can be edited, switched off or deleted under
**WhatsApp Management → Workflows**, and new ones added with these choices:
*New enquiry added, Enquiry follow-up date, Membership expiry, Member birthday,
Plan sold (invoice), Payment received (receipt)*, sent *N days before / on the
day / N days after* where that makes sense.

The starter wording (with emojis and WhatsApp *bold*) lives in
`src/lib/whatsapp/messages.ts`; each gym can rewrite its own copy under
**Workflows**. New gyms start with the latest wording.

### Placeholders

Type these in a message; each person gets their own values.

| Placeholder | Becomes |
|---|---|
| `{name}` / `{first_name}` | Rahul Sharma / Rahul |
| `{gym}` | Your gym name from Gym Settings |
| `{service}` | Package name |
| `{expiry_date}` | Membership end date |
| `{followup_date}` | Enquiry follow-up date |
| `{amount}` / `{paid}` / `{due}` | Package price / amount paid / balance |
| `{invoice_link}` | Link to the printable invoice |
| `{offer}` | In renewal reminders: "🏷️ Renew now at just ₹900 (10% off till 31-10-2026)" when the package has an offer, otherwise nothing |
| `{package}` / `{price}` / `{offer_price}` / `{discount}` / `{valid_till}` | In offers about a package: its name, normal price, offer price, "10% off", last day |

## The gym's WhatsApp group

**WhatsApp Management → WhatsApp group → Choose group** lists the groups the
gym's linked number is in. Pick the gym's group (the number must be an **admin**
there; other groups cannot be chosen) and keep **Add new members automatically** on.

- Every new member is added to the group from the gym's number, once.
- If their WhatsApp privacy settings do not allow being added (or they left the
  group recently), they get a message with the group's invite link instead.
- BackDate members and Excel imports are not added automatically.
- **Add to WhatsApp group** on a member's profile adds anyone by hand, for
  example existing members.
- Each attempt shows in **Sent messages** as *WhatsApp group*: "Added to the gym's
  WhatsApp group", "Already in the group", or the invite message that was sent.

## Linking the gym's number

1. **WhatsApp Management** → a QR code appears.
2. On the gym phone: WhatsApp → Settings → **Linked devices** → **Link a device** → scan.
3. The card turns **Connected** and shows the number. Use **Send test** to message
   yourself.

**Unlink** disconnects the number (for example to switch phones). The phone
must stay connected to the internet for messages to go out.

## Testing it safely

Every queued message goes to a **real** WhatsApp number once a number is
linked. Invented test numbers can belong to real people.

1. **Before linking**, make every test member, enquiry and trainer use **your
   own** mobile number. WhatsApp delivers messages to yourself.
2. Link the number, then go through the checks in [TESTING.md](TESTING.md#whatsapp-automation).
3. Watch **Sent messages**: each row shows who, what, and *Sent / Waiting / Failed*.
4. To stop everything instantly, press **Unlink**. Waiting messages stay waiting
   (and expire after 24 hours).

The automated browser tests (`npm run test:e2e`) never reach WhatsApp: they run
against a stand-in sender on a separate database.

## Troubleshooting

| You see | Meaning | What to do |
|---|---|---|
| Red "WhatsApp is not connected" banner | No number linked | WhatsApp Management → scan |
| Card says *Starting…* or *Offline* | The sender is waking up (free hosting sleeps) or down | Wait a minute; check the sender's `/health` address |
| Messages stuck on *Waiting* | Number not linked, or sender down | Link the number; they send within seconds |
| *Failed: This number is not on WhatsApp* | The member's number has no WhatsApp | Correct the number on the member |
| *Failed: Not sent within 24 hours* | WhatsApp was unlinked for a day | **Retry failed** after linking, if still relevant |
| *Failed: No reply from WhatsApp* | Slow reply; may or may not have been delivered | Check with the member before retrying |

## Limits

- Linking by QR is unofficial. Sending many messages quickly can get a number
  restricted by WhatsApp; the built-in gaps reduce but do not remove that risk.
- Render's free plan has 512 MB of memory; each linked gym uses some. Expect
  room for about 5–10 gyms before a paid plan is needed.
