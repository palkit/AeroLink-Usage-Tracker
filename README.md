# Aerolink Usage Panel

Ek dashboard jisme aap apne **3-4 Aerolink accounts** ki API keys daal ke sabki usage
ek saath dekh sakte ho — kaunsi key chalti hai (🟢), kaunsi limit reached (🔴), kitna
`$` use hua, aur reset hone me kitna time bacha (estimate).

Background me server khud check karta rehta hai — aapke browser kholne ka wait nahi:
- 🟢 Green key → har **5 min**
- 🔴 Red key → har **2 min** (jaldi pata chale kab wapas active hui)

---

## Local pe chalane ke liye

```bash
cd aerolink-panel
npm install
npm run dev
# http://localhost:3000 kholo
```

Bina database ke bhi chalega — keys `.data/store.json` (local file) me save hoti hain.
Settings → account name + `aero_live_...` key daalo → done.

---

## Vercel pe deploy (online, 24/7 background check)

### 1. Code GitHub pe daalo
```bash
cd aerolink-panel
git init && git add . && git commit -m "aerolink panel"
# GitHub pe naya repo banao, phir:
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Vercel pe import
- [vercel.com](https://vercel.com) → New Project → apna repo import karo → Deploy.

### 3. Database jodo (keys online save karne ke liye)
Vercel dashboard me project → **Storage** → **Upstash Redis** (free tier) → Create → Connect.
Yeh apne aap ye 2 env vars daal dega:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Env var daalne ke baad project ko **Redeploy** karo.

### 4. Background check chालू karo
`vercel.json` me cron pehle se set hai (`/api/cron` har minute).

⚠️ **Zaroori:** Vercel ka **free (Hobby) plan** cron ko sirf **din me 1 baar** chalata hai.
5-min/2-min ke liye 2 options:

- **Option A (paid):** Vercel **Pro** (~$20/mo) → cron har minute chalega, kuch nahi karna.
- **Option B (free):** [cron-job.org](https://console.cron-job.org) pe free account banao →
  naya cronjob → URL: `https://<your-app>.vercel.app/api/cron` → har **1 minute** →
  save. Bas. (Server andar khud decide karta hai green 5min / red 2min.)

  Extra security ke liye Vercel me `CRON_SECRET` env var daalo, phir URL:
  `https://<your-app>.vercel.app/api/cron?secret=<your-secret>`

---

## Kaise kaam karta hai (short)

- Panel har key pe ek **tiny request** (1 token) bhejta hai capi.aerolink.lat pe.
  - `200 OK` → key active 🟢
  - `402` → limit reached 🔴 + error text se window (5h/weekly) aur used-`$` nikaalta hai.
- Reset time **estimate** hai: jab pehli baar 🔴 dekha us time + window duration (5h ya 7 din).
  Isliye background check jitna baar-baar chalega, estimate utna sateek.
- Green key pe ek check ~$0.002 se bhi kam kharch karta hai (bilkul ignore karne layak).

## Files
- `app/page.js` — dashboard UI (cards, rings, settings)
- `app/api/accounts` — keys add/delete
- `app/api/status` — dashboard data
- `app/api/refresh` — "Check now" button
- `app/api/cron` — background auto-check (5min green / 2min red)
- `lib/checker.js` — key ping + parse logic
- `lib/storage.js` — Upstash Redis (online) / local file (dev)
