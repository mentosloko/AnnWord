# AnnWord production deployment source of truth

## Production runtime

AnnWord production is fully hosted in Yandex Cloud.

- Production frontend: Yandex Object Storage.
- Production backend: Yandex Serverless Container.
- Production database: Yandex Managed PostgreSQL.
- Production email: Yandex Postbox.
- Production container images: Yandex Container Registry.
- Production OAuth: Yandex OAuth through the AnnWord backend.
- Production branch: `main`.

Supabase and Vercel are **not production runtime components**. Their remaining files, dependencies, migration code, external project settings or provider integrations are legacy/compatibility surfaces only and must never be treated as evidence of the production architecture.

## Deployment chain

The supported production chain is:

`main` → `.github/workflows/yandex-deploy.yml` → Yandex Container Registry / Serverless Container / Object Storage → `.github/workflows/yandex-smoke.yml` + `.github/workflows/production-operations.yml`.

- `.github/workflows/ci.yml` validates changes but does not deploy production.
- `.github/workflows/yandex-deploy.yml` publishes both frontend and backend and runs PostgreSQL migrations for pushes to `main`.
- `.github/workflows/yandex-smoke.yml` verifies the live Yandex frontend, API, database, Postbox and protected endpoints.
- `.github/workflows/production-operations.yml` monitors production and enforces PostgreSQL backup policy.

Repo-owned Vercel deployment, production-verification and preview-promotion workflows have been retired. `vercel.json` sets `git.deploymentEnabled` to `false`, so the remaining detached Vercel project must not create deployments from Git pushes or pull requests. The Vercel project has no AnnWord custom production domains; only `*.vercel.app` aliases remain.

The Vercel project itself may remain temporarily as an inert external resource. Automated deletion from GitHub is not available because no repository Vercel API token is configured; this does not affect the Yandex deployment chain.

## Runtime dependency rule

Client production services must use the AnnWord backend API (`api.annword.ru` in production). They must not import or call the Supabase client as a runtime fallback.

Legacy Supabase/Vercel code may remain temporarily only when needed to retire old infrastructure safely. It must be removed in separate cleanup steps after the Yandex-only path has passed CI, deployment and live runtime smoke checks.

## Safe decommission order

1. Keep Yandex deployment, runtime smoke and production monitoring green.
2. Remove client/runtime fallbacks to legacy providers.
3. Verify a real `main` deployment reaches `annword.ru` and `api.annword.ru` without legacy-provider involvement.
4. Remove repo-owned Vercel checks/workflows and verify another Yandex deployment.
5. Verify the Vercel project has no AnnWord custom domains.
6. Disable Vercel Git deployments and verify a new `main` push does not create a Vercel deployment.
7. Delete the inert Vercel project later through an authenticated Vercel account/API session when convenient; this is not a production dependency.
