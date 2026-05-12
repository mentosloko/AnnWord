# AnnWord

AnnWord is a Vite + React app for studying English words with Supabase-backed user profiles, custom dictionaries, stats, coins, pet state, inventory, and OAuth/email authentication.

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
