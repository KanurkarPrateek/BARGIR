# I host gym software for my friends' gyms on ₹0/month. Here's the control plane that makes it work.

*Bro, I'm not paying for servers for a side project.*

I built gym management software: members, renewals, biometric attendance, WhatsApp reminders, invoices, the whole ERP. Then came the real question. My friends run gyms and wanted to use it. **How do I host it for all of them without paying for servers?**

My answer: free tiers. Lots of them. And one small app on top that manages them all. That app is the **control plane**. I call it the Control Panel.

Right now **4 friends' gyms run on one cluster**, and it's working smooth. Hosting bill: zero.

---

## The trick: a "cluster" is just three free accounts

Each free tier on its own is small. But one Vercel + one Supabase + one Render account together can run a full copy of the app for about 5 gyms.

| Piece | Free service | What it does |
|---|---|---|
| The app | **Vercel** | Every screen, sign-in, and the address the biometric machines push punches to |
| The database | **Supabase** (Postgres) | All the gyms' data in one database, each row tagged with its `gym_id` |
| WhatsApp sender | **Render** | Keeps each gym's WhatsApp linked and sends the queued messages |

That set of three is a **cluster**. When cluster-1 fills up, I make three new free accounts and add cluster-2. Then cluster-3. You scale out by adding more free accounts, not by upgrading one big server.

If you come from DevOps: think of each cluster as a node pool. The control plane is the scheduler and API server sitting on top.

![How the Control Panel manages free clusters](images/00-architecture-v2.jpg)

---

## What the Control Panel does

It's a separate small Next.js app (`control/` in the repo) with its own free Vercel project and its own Supabase database. Gyms never see it. Only I use it.

### 1. One screen for everything

![Control Panel dashboard](images/03-dashboard.jpg)

How many gyms are on, whose renewal is coming up, and the part I care about most: **how much room is left on each cluster**. At 4 of 5 it already warns me to set up a new cluster before adding the next gym. No surprise "out of capacity" moments. (The revenue and commission numbers in these screenshots are demo data.)

### 2. Clusters, with live health

![Clusters list](images/04-clusters.jpg)

Every cluster lists its gyms, its health (database, WhatsApp sender, response time, deployed version), and which free accounts it runs on.

Open one and you see everything live from that deployment:

![Cluster detail](images/08-cluster-detail.jpg)

The Control Panel calls the cluster's `/api/platform/status` and `/api/platform/gyms`, so the numbers come from the cluster itself, not from a copy I have to keep in sync.

### 3. Adding a new cluster takes about 10 minutes

![New cluster form](images/02-new-cluster-form.jpg)

This was the part I hated doing by hand: making up secrets, copying database URLs, getting the same key into Vercel *and* Render without a typo.

Now:

1. Make free Vercel, Supabase and Render accounts.
2. Click **New cluster**. Every secret (`SESSION_SECRET`, `WHATSAPP_WORKER_KEY`, `CRON_SECRET`, `PLATFORM_API_KEY`, admin password) is already generated.
3. Paste in the two Supabase pooler URLs.
4. Click **Copy Vercel settings**, paste into Vercel, deploy. Click **Copy Render settings**, paste into Render's blueprint.
5. Reload. Health goes green. The cluster now shows up when I create a gym.

Every secret is stored **encrypted** (AES-256-GCM, keyed on one `CONTROL_SECRET`), so any cluster can be rebuilt or checked later without hunting through old notes.

### 4. Onboarding a new gym: one form

Another friend wants in? Fill this in:

![New gym form](images/05-new-gym-form.jpg)

The cluster picker only offers clusters that are **up and have room**, emptiest first. Press **Create gym** and the Control Panel calls `POST /api/platform/gyms` on that cluster. In one database transaction the cluster creates:

- the gym,
- the owner's login,
- the default WhatsApp workflows (renewal reminders, birthday wishes, and so on).

If anything fails halfway, nothing is left behind. Then I get the login to send the owner:

![Gym created with owner login](images/06-gym-created.jpg)

The owner opens the link, signs in, and lands in their own gym with a setup checklist:

![Owner's first login](images/07-owner-first-login.jpg)

From "hey, can my gym use this?" to "owner is inside the software": **under a minute.** No deploy, no new database, no config change.

### 5. All the gyms in one list

Every gym with its owner, renewal date, which cluster it's on, and live usage:

![Gyms list](images/09-gyms.jpg)

If I ever need to switch a gym off, it's one button: **Suspend**. Sign-in stops on the cluster right away. **Resume** brings it back.

(The panel also has billing and sales-team screens. I built them, but I don't need them for friends' gyms.)

---

## How it fits together (for the nerds)

**Many gyms, one database per cluster.** Every gym-owned table has a `gym_id`. The app uses a tenant-scoped Prisma client (`src/lib/tenant.ts`) that adds the current gym to *every* query and refuses to run if no gym is known. One gym can't read another gym's rows, even if I write a buggy query.

**The control plane talks to clusters through one small API.** Each cluster exposes `/api/platform/*`, protected by a `PLATFORM_API_KEY` bearer token (compared in constant time). If that key isn't set, the API refuses everything.

| Call | Used for |
|---|---|
| `GET /api/platform/status` | Health: app, database, WhatsApp sender, version |
| `GET /api/platform/gyms` | Gyms with members, last activity, WhatsApp linked |
| `POST /api/platform/gyms` | Create a gym and its owner login |
| `PATCH /api/platform/gyms/<id>` | Suspend / resume, reset owner password |
| `…/gyms/<id>/logins` | Add, change or remove owner and reception logins |

**The WhatsApp sender is separate on purpose.** Vercel functions can't hold a long-lived WhatsApp connection, so the app only *queues* messages in the database. The Render worker keeps each gym's session open and sends them, 3–6 seconds apart, only between 9 am and 9 pm India time.

**Tricks to keep the free tiers happy:**

- Use Supabase's **pooler** connection strings. The direct one is IPv6-only on the free plan, and Vercel and Render can't reach it.
- Put Vercel's functions in the **same region** as Supabase (I'm on Sydney for both).
- Render's free plan sleeps idle services, so the sender pings itself every 10 minutes. A daily Vercel cron also wakes it as a backup.
- Supabase pauses projects after a week of no activity. Gyms check in members every day, so that never happens.
- Nightly encrypted database backups run on GitHub Actions. Also free.

---

## Where it stands

- **4 gyms live on cluster-1.** Health is green, members get their reminders on WhatsApp. Smooth.
- **Total hosting cost: ₹0.**
- **When gym #6 signs up**, I add cluster-2 in about 10 minutes and the Control Panel starts putting new gyms there.

### Caveats, so nobody @'s me

- **Vercel Hobby is for personal, non-commercial projects.** That's what this is: software for friends' gyms. If it ever turns into a paid product, the Vercel side moves to Pro, one cluster at a time.
- **Render free has 512 MB of memory.** Each linked WhatsApp session uses some, so I watch memory as gyms are added. That's the real reason a cluster holds ~5 gyms.
- **WhatsApp linking by QR is unofficial.** Sending too fast can get a number restricted, which is why the sender is slow on purpose.

The lesson: you don't need Kubernetes or a VPS to host real software for real people. You need a cheap unit you can copy (one cluster), and a small control plane that makes copying it boring.

Ship it, bro. 💪

---

*Screenshots are from a local copy of the Control Panel with demo gyms and test-only logins, set up the same way as production.*
