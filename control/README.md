# Control Panel

The internal app that runs the gym software as a business. Only you and your
sales team use it; gyms never see it.

| Screen | What it does |
|---|---|
| **Dashboard** | Monthly recurring revenue, money collected, gyms on trial / suspended, renewals overdue or due in 7 days, commission owed, room left on each cluster |
| **Gyms** | Every gym customer: owner, city, plan and price, next renewal, who sold it, cluster, live usage (members, WhatsApp linked). Create a gym (makes the gym and its owner login on the chosen cluster), link a gym that signed itself up, record payments, suspend / resume / cancel. **Logins**: every owner and reception (front-desk) login of the gym; add one, change its name, mobile, role or password, or remove it. A gym always keeps one owner. The new login's details are shown once to copy and send |
| **Billing** | Collected per month, upcoming renewals, recent payments |
| **Clusters** | Each free set of Vercel + Supabase + Render accounts holding up to N gyms: live health, the gyms on it, the account emails, and every setting (encrypted) ready to paste into Vercel and Render |
| **Sales team** | Salespeople, their commission %, gyms sold, commission earned / paid / owed, payouts |

**Salespeople** get their own login and see only the gyms they sold and their own commission.
**Commission** is booked on every payment a gym makes: payment × the gym's commission %
(copied from the salesperson when the gym is sold; can be changed per gym).

## How it talks to the clusters

Each cluster (a deployment of the gym app in the folder above) has a
`PLATFORM_API_KEY`. The Control Panel keeps that key encrypted and calls the
cluster's `/api/platform/*`:

| Call | Used for |
|---|---|
| `GET /api/platform/status` | Health: app, database, WhatsApp sender, version |
| `GET /api/platform/gyms` | Gyms on the cluster with members, last activity, WhatsApp linked |
| `POST /api/platform/gyms` | Create a gym with its owner login |
| `PATCH /api/platform/gyms/<id>` | Switch sign-in off / on (suspend), reset the owner's password |
| `GET/POST /api/platform/gyms/<id>/logins` | List the gym's logins, or add one (`role`: `owner` or `staff` = reception) |
| `PATCH/DELETE /api/platform/gyms/<id>/logins/<loginId>` | Change a login's name, mobile, role or password, or remove it |

Without `PLATFORM_API_KEY` set on a cluster, its API refuses every call.

## Adding a cluster (every 5 gyms)

1. Make free accounts (a new email address each time works): **Supabase**, **Vercel**, **Render**.
2. Control Panel → **Clusters → New cluster**. Fresh secrets are already filled in.
   From Supabase → **Connect**, paste the transaction pooler and session pooler
   addresses into the two database boxes. Enter the Vercel address you will use. **Save**.
3. On the cluster page, **Copy Vercel settings** → Vercel project (import the
   GitHub repository) → Settings → Environment Variables → paste → deploy.
4. **Copy Render settings** → Render → New → Blueprint → the repository → paste
   the values. Put the Render address into *WhatsApp sender address*, save, copy
   the Vercel settings again (they now include it) and redeploy Vercel.
5. Reload the cluster page: **Health** shows App, Database and Sender OK.
   **New gym** now offers this cluster.

The New gym form only offers clusters that answer and have room, emptiest first.

## Deploying the Control Panel itself

Its own free Supabase project and its own Vercel project:

1. Supabase: a new project for the Control Panel (not one of the clusters).
2. Vercel: import the same repository and set **Root Directory** to `control`.
3. Environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Supabase transaction pooler, with `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | Supabase session pooler |
   | `CONTROL_SECRET` | `openssl rand -hex 32`. **Never change it**: it encrypts the cluster keys |
   | `CONTROL_ADMIN_EMAIL` | your email |
   | `CONTROL_ADMIN_PASSWORD` | a strong password; the first sign-in creates your admin login |

4. Deploy (`vercel-build` creates the tables), sign in, add your clusters.

Keep this app's address private; it can switch any gym off.

## Running it locally

```bash
cd control
cp .env.example .env        # fill CONTROL_SECRET and the admin login
npm install
npx prisma db push
npm run dev                 # http://localhost:3400
```

On Node 25 use `NODE_OPTIONS=--no-experimental-webstorage npm run dev`.
To manage a local gym app, put a `PLATFORM_API_KEY` in its `.env` and add a
cluster with address `http://localhost:3000` and that key.

Tests: `npm run test:e2e` in the main folder runs the Control Panel suite last.
