# Deploying on Vercel + Supabase + Render (free tiers)

Three pieces:

| Piece | Runs on | What it does |
|---|---|---|
| The app (this repo) | Vercel | All screens, sign-in, and the address biometric machines talk to |
| The database | Supabase | Every gym's data, in one Postgres database |
| WhatsApp sender (`worker/`) | Render | Keeps each gym's WhatsApp number linked and sends the queued messages |

Do the steps in this order. You will create three secrets along the way; any
long random text works (for example the output of `openssl rand -hex 32`):

- `SESSION_SECRET` — only on Vercel
- `WHATSAPP_WORKER_KEY` — same value on Vercel and Render
- `CRON_SECRET` — same value on Vercel and Render

## 1. Supabase (database)

1. Create a project at supabase.com. Pick a region near India (Mumbai or Singapore).
2. Open **Connect** and copy two connection strings:
   - **Transaction pooler** (port 6543). Add `?pgbouncer=true&connection_limit=1` to the end.
     This is `DATABASE_URL` for Vercel.
   - **Session pooler** (port 5432). This is `DIRECT_URL` for Vercel and `DATABASE_URL` for Render.

Use the pooler strings, not the "Direct connection" one: the direct address is
IPv6-only on the free plan, and Vercel and Render cannot reach it.

The tables are created automatically on the first Vercel deploy.

## 2. Vercel (the app)

1. Import the GitHub repository at vercel.com.
2. Add these environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Supabase transaction pooler string (with the `?pgbouncer=true…` ending) |
   | `DIRECT_URL` | Supabase session pooler string |
   | `SESSION_SECRET` | your first secret |
   | `SUPERADMIN_LOGIN` | what you type to sign in as the platform admin, e.g. `admin` |
   | `SUPERADMIN_PASSWORD` | a strong password for that login |
   | `WHATSAPP_WORKER_KEY` | your second secret |
   | `CRON_SECRET` | your third secret |
   | `WHATSAPP_WORKER_URL` | leave empty for now; filled in step 4 |
   | `ALLOW_SIGNUP` | optional: `false` to stop gyms signing themselves up at `/signup` |

3. Deploy. Vercel runs `vercel-build`, which creates the database tables and builds the app.
4. Open `https://<your-app>.vercel.app/signin` and sign in with the admin login.

## 3. Render (WhatsApp sender)

1. At render.com choose **New → Blueprint** and select the same repository. It reads `render.yaml`.
2. Fill in the values it asks for:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Supabase **session pooler** string |
   | `WHATSAPP_WORKER_KEY` | same as on Vercel |
   | `CRON_SECRET` | same as on Vercel |
   | `APP_URL` | `https://<your-app>.vercel.app` |

3. After it deploys, copy its address (`https://gym-whatsapp-sender-xxxx.onrender.com`).
   Opening `<that address>/health` should show `{"ok":true,...}`.

## 4. Connect the two

1. On Vercel set `WHATSAPP_WORKER_URL` to the Render address and redeploy.
2. Either sign in as admin and **Add gym**, or let the gym owner sign themselves up at
   `https://<your-app>.vercel.app/signup`. Either way the owner lands in the setup wizard.
3. Open **WhatsApp** in the sidebar and scan the QR code with the gym's phone
   (WhatsApp → Settings → Linked devices → Link a device).

## Running several clusters

Free plans hold about 5 gyms per set of accounts. To grow, repeat steps 1–4 with
new accounts for each set, and manage them all from the **Control Panel**
(`control/`, see [control/README.md](control/README.md)). It generates each
cluster's secrets, gives you the values to paste into Vercel and Render, creates
gyms on the cluster with room, and switches gyms off when they stop paying.
Each cluster then also needs `PLATFORM_API_KEY` (included in what the Control
Panel gives you), and `ALLOW_SIGNUP=false` so gyms are added through it.

## 5. Biometric machines

Every gym's machine points at the same address; the gym adds its machine's
serial number under **Attendance → Biometric**.

- **Machine has an HTTPS option:** server address `<your-app>.vercel.app`, port `443`, domain name on, HTTPS on.
- **Machine is HTTP only:** Vercel will not accept it directly. Put the small relay in
  `tools/cloudflare-biometric-relay.js` on a Cloudflare hostname (steps are at the top of
  that file), then use that hostname with port `80` and HTTPS off.
- **No network / no Cloud Server menu:** use the pen-drive import on the Biometric page.

Set `BIOMETRIC_SERVER_ADDRESS` and `BIOMETRIC_SERVER_PORT` on Vercel so the Biometric
page shows gyms the right values to type in.

To try it without a machine: `npm run simulate:biometric -- --server https://<address> --serial TEST-001`.

## How the automatic messages run

- The sender asks the app every 5 minutes which messages are due and sends them
  between 9 am and 9 pm India time.
- Vercel also runs the same check once a day at 10 am (`vercel.json`), which wakes the
  sender if it had gone to sleep.
- Render's free plan sleeps a service that gets no traffic; the sender pings itself
  every 10 minutes to stay awake.

## Limits of the free setup

- **Render free:** 512 MB memory and one shared CPU. Each linked gym uses memory, so
  expect room for roughly 5–10 gyms before it needs a paid plan. Check actual memory
  use in Render as gyms are added.
- **Vercel Hobby** is for personal, non-commercial use under Vercel's terms. Charging
  gyms for this means moving to their Pro plan.
- **Supabase free** pauses a project after a week with no activity and has a 500 MB
  database limit.
- **WhatsApp:** linking by QR is unofficial. Sending many messages quickly can get a
  number restricted by WhatsApp; the sender waits 3–6 seconds between messages for this reason.

## Running it locally

```bash
docker start gym-management-db          # Postgres on port 5433
cp .env.example .env                     # then fill in the secrets
npx prisma db push
npm run dev                              # app on http://localhost:3000

cd worker && npm install
# with the same DATABASE_URL, WHATSAPP_WORKER_KEY and CRON_SECRET as the app:
APP_URL=http://localhost:3000 npm start  # sender on http://localhost:3200
```

On Node 25 start the app with `NODE_OPTIONS=--no-experimental-webstorage npm run dev`.
