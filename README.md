# 📳 BuzzLink — Vibrate Your Friend's Phone

A Next.js app where you and a friend join the same **room code**, and you can:

1. **Buzz their phone** with a tap (choose a vibration pattern).
2. Ask **"When will you reach?"** — their phone pops a prompt they're *obliged* to answer with an arrival time.
3. **Bonus free-API feature:** show the weather at your current spot (OpenWeatherMap).

Built to deploy **free on Vercel**.

---

## How the cross-device buzz works

A browser's `navigator.vibrate()` only vibrates the *local* phone. To buzz a *friend's* phone we need a realtime channel between devices. This app uses **[Pusher Channels](https://pusher.com)** (generous free tier) — taps go to a serverless API route which broadcasts the event to everyone in the room. This pattern works perfectly on Vercel's free plan (serverless functions can't hold WebSockets, Pusher does that for us).

> ⚠️ Real haptic vibration works on **Android Chrome**. **iOS Safari blocks the Vibration API**, so on iPhones you get a buzz *sound* + screen shake fallback instead. This is an OS limitation, not a bug.

---

## 1. Get free API keys (5 minutes)

### Pusher (required)
1. Sign up free at <https://dashboard.pusher.com>.
2. Create a **Channels** app (pick the cluster closest to you, e.g. `eu`, `us2`, `ap2`).
3. Open **App Keys** and copy `app_id`, `key`, `secret`, `cluster`.

### OpenWeatherMap (optional bonus)
1. Sign up free at <https://home.openweathermap.org/users/sign_up>.
2. Copy your key from **API keys** (may take ~1 hour to activate).

---

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

```
PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=...
NEXT_PUBLIC_PUSHER_KEY=...        # same as PUSHER_KEY
NEXT_PUBLIC_PUSHER_CLUSTER=...    # same as PUSHER_CLUSTER
OPENWEATHER_API_KEY=...           # optional
```

---

## 3. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000> on two devices/tabs, join the same room code, and buzz away.
To test across real phones locally, expose your dev server (e.g. `npx localtunnel --port 3000`) or just deploy.

---

## 4. Deploy free on Vercel

1. Push this folder to a GitHub repo.
2. Go to <https://vercel.com/new>, import the repo (framework auto-detected as **Next.js**).
3. In **Settings → Environment Variables**, add the same 7 variables from your `.env.local`.
4. Click **Deploy**. You get a free `*.vercel.app` URL.

Or with the CLI:

```bash
npm i -g vercel
vercel            # follow prompts
vercel --prod     # add the env vars in the dashboard, then promote to production
```

---

## Tech

- **Next.js 14** (App Router, TypeScript)
- **Pusher Channels** for realtime device-to-device events
- **OpenWeatherMap** for the bonus weather widget
- Zero CSS framework — handcrafted mobile-first UI
