# AnnWord

AnnWord is a Vite + React application for learning English words through games, child/parent profiles, teacher assignments, progress tracking, gamification and Premium features.

## Production architecture

AnnWord production is fully hosted in Yandex Cloud:

- frontend — Yandex Object Storage;
- backend — Yandex Serverless Container;
- database — Yandex Managed PostgreSQL;
- container images — Yandex Container Registry;
- email — Yandex Postbox;
- OAuth — Yandex OAuth through the AnnWord backend.

The production branch is `main`.

The production deployment chain is:

```text
main
  -> .github/workflows/yandex-deploy.yml
  -> Yandex Container Registry / Serverless Container / Object Storage
  -> .github/workflows/yandex-smoke.yml
  -> .github/workflows/production-operations.yml
```

Supabase and Vercel are not production runtime components. Vercel Git deployments are disabled in `vercel.json`.

See `docs/DEPLOYMENT_SOURCE_OF_TRUTH.md` for the authoritative deployment contract.

## Local frontend development

Prerequisites:

- Node.js compatible with the repository dependencies;
- npm.

Install dependencies:

```bash
npm install
```

Create a local frontend environment file:

```bash
cp .env.example .env.local
```

Start Vite:

```bash
npm run dev
```

The frontend usually opens at `http://localhost:5173`.

For authenticated flows, point `VITE_API_URL` at a running AnnWord backend.

## Local backend development

The active backend entrypoint is `server/yandex-api.ts`.

Server-side environment variables for PostgreSQL, sessions, Yandex OAuth, Prodamus and Object Storage are documented in `.env.yandex.example`.

Start the backend in watch mode:

```bash
npm run api:dev
```

Run the backend smoke check:

```bash
npm run api:check
```

Run Yandex PostgreSQL migrations:

```bash
npm run db:yandex:migrate
```

## Quality checks

```bash
npm run lint
npm run test:run
npm run check:smoke
npm run build
```

The CI workflows run TypeScript checks, tests, smoke checks and production builds before changes are promoted.

## Deployment safety

A successful production release is not established by a build alone. The expected sequence is:

1. `Deploy to Yandex Cloud` succeeds for the `main` commit.
2. The live frontend release marker exposes that commit SHA.
3. `Yandex Runtime Smoke` verifies frontend routes, API, PostgreSQL, Postbox and protected endpoints.
4. `Production Operations` verifies monitoring and PostgreSQL backups.

Vercel previews, old Supabase migrations and other legacy files must never be treated as the source of truth for production.
