# AnnWord

AnnWord is a Vite + React app for studying English words with Supabase-backed user profiles, custom dictionaries, stats, coins, pet state, inventory, and OAuth/email authentication.

## Vercel frontend deployment

This repository is prepared for Vercel deployment via `vercel.json`.

Recommended Vercel settings:

```text
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
Root Directory: ./
```

Required Vercel Environment Variables:

```bash
VITE_SUPABASE_URL=https://qbznenczthmznootlujy.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

Optional Vercel Environment Variables:

```bash
VITE_ADMIN_EMAILS=
GEMINI_API_KEY=
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code. Add it only if you later move server-side logic to Vercel Functions and keep it server-only.

The current Vercel setup is for the frontend app. The custom Yandex OAuth flow in `server.ts` is not executed by a static Vercel frontend deployment. For Yandex OAuth in production, move `/api/auth/yandex` and `/api/auth/yandex/callback` to Vercel Functions or Supabase Edge Functions.

After importing the GitHub repository into Vercel, every push to `main` should create a new production deployment. Pull requests should create preview deployments if the Git integration is enabled.

## Local frontend run

Prerequisites:

- Node.js 20+
- Supabase project with the migrations from `supabase/migrations` applied

### 1. Install dependencies

```bash
npm install
```

### 2. Create local environment file

Copy the template:

```bash
cp .env.example .env.local
```

Fill at least:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

For the current Supabase project, use the Project URL and anon/publishable key from Supabase Dashboard → Project Settings → API.

### 3. Start the frontend

```bash
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://localhost:5173
```

This mode is enough to test the main frontend and Supabase auth/profile flows.

## Local full-stack run with Yandex OAuth server

The custom Yandex OAuth flow is implemented in `server.ts` and needs server-only secrets:

```bash
SUPABASE_SERVICE_ROLE_KEY=
YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
APP_URL=http://localhost:3000
```

Then run:

```bash
npm run server
```

Open:

```text
http://localhost:3000
```

## Useful scripts

```bash
npm run dev      # Vite frontend only
npm run server   # Express + Vite middleware, needed for /api/auth/yandex
npm run build    # production build
npm run preview  # preview built app
npm run lint     # TypeScript check
```

## Supabase schema

The database schema is versioned in:

```text
supabase/migrations/
```

The main app currently expects:

- `public.profiles`
- RLS policies for authenticated users
- RPC function `public.increment_coins(user_id uuid, amount integer)`
