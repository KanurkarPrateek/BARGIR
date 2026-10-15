# Gym Manager

Software for running one or many gyms: members, plans and sales, payments,
attendance (manual or biometric machine), trainers, enquiries, and automatic
WhatsApp messages. Each gym signs in separately and sees only its own data.

Based on [atharvaarbat/gym-management](https://github.com/atharvaarbat/gym-management).

## Features

**Management:** Dashboard · Universal Search Member · Attendance Management
(Member Attendance, Staff Attendance, View Attendance) · Member Management
(Add Member, View Member, View Batch, InActive Member, BlackList Member, Dormant
Member) · Enquiry Management · Subscription Management (Add Subscription, View
Subscriptions, View Pending Renewal, Pending Payments) · Package Management ·
Trainer Management (PT clients) · BackDate Management

**Add on:** Expense Management (with profit by month and Payment Report) ·
WhatsApp Management (automatic workflows, offers, invoices and receipts) ·
invoice email · Fitness Tools

**Staff:** Staff Management with front-desk logins and shifts

**Biomax:** Biometric Management (Add, Block, Delete, Link IDs, View Commands,
auto-block on expiry) for eSSL / ZKTeco / BioMax push machines

## Documentation

| Read | For |
|---|---|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Gym owners and front desk: every screen and the daily routine |
| [docs/TESTING.md](docs/TESTING.md) | Automated tests and the manual test checklist |
| [docs/WHATSAPP.md](docs/WHATSAPP.md) | How automatic messages work, setup, safe testing, troubleshooting |
| [docs/BIOMETRIC.md](docs/BIOMETRIC.md) | Connecting machines, enroll / block / delete, testing with the simulator |
| [DEPLOY.md](DEPLOY.md) | Deploying on Vercel + Supabase + Render, and running locally |

## What is in the repository

| Path | What it is |
|---|---|
| `src/` | The web app (Next.js, Prisma, Postgres) |
| `worker/` | WhatsApp sender: keeps each gym's number linked and delivers queued messages |
| `tools/biometric-simulator/` | Pretends to be an attendance machine, for testing without hardware |
| `tests/` | Browser tests: `npm run test:e2e` (see docs/TESTING.md) |
| `docs/` | User guide, testing, WhatsApp and biometric guides |
| `tools/cloudflare-biometric-relay.js` | Relay for machines that can only send plain HTTP |
| `DEPLOY.md` | Deploying on Vercel + Supabase + Render, and running locally |

## How it fits together

- **Sign-in:** gym owners and front-desk staff sign in at `/signin`; staff
  logins cannot open owner pages (route group `src/app/(sidebar)/(owner)`, and
  `requireOwner()` in the server actions).
- **Errors:** server actions that can refuse something return the message as a
  value (`safe()` in `src/lib/safe-action.ts`, `call()` on the screen), because
  Next.js hides thrown error messages in production.
- **Platform admin:** set by `SUPERADMIN_LOGIN` / `SUPERADMIN_PASSWORD`; creates
  gyms at `/admin/gyms`.
- **One database for all gyms:** every business table has a `gym_id`.
  `src/lib/tenant.ts` exports the database client the app uses; it adds the
  signed-in gym to every query. `src/lib/prisma.ts` is the unscoped client and
  is only for code that runs before a gym is known.
- **WhatsApp:** the app only writes rows to `WhatsappMessage`. The worker
  sends them. `/api/cron/tick` queues messages that have become due.
- **Biometric:** eSSL / ZKTeco / BioMax "push" machines call `/iclock`. A gym
  registers its machine's serial number, which routes punches to that gym.

See `DEPLOY.md` to run or deploy it.
