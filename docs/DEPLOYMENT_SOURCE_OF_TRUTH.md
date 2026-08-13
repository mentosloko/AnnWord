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

Supabase and Vercel are **not production runtime components**. Their remaining files, workflows, dependencies, or migration code are legacy/compatibility surfaces only and must never be treated as evidence of the production architecture.

## Deployment chain

The supported production chain is:

`main` → `.github/workflows/yandex-deploy.yml` → Yandex Container Registry / Serverless Container / Object Storage → `.github/workflows/yandex-smoke.yml` + `.github/workflows/production-operations.yml`.

- `.github/workflows/ci.yml` validates changes but does not deploy production.
- `.github/workflows/yandex-deploy.yml` publishes both frontend and backend and runs PostgreSQL migrations for pushes to `main`.
- `.github/workflows/yandex-smoke.yml` verifies the live Yandex frontend, API, database, Postbox and protected endpoints.
- `.github/workflows/production-operations.yml` monitors production and enforces PostgreSQL backup policy.

Vercel deployments are previews/legacy verification only and must not be required by, called from, or used as a fallback by any Yandex production workflow.

## Runtime dependency rule

Client production services must use the AnnWord backend API (`api.annword.ru` in production). They must not import or call the Supabase client as a runtime fallback.

Legacy Supabase/Vercel code may remain temporarily only when needed to retire old infrastructure safely. It must be removed in separate cleanup steps after the Yandex-only path has passed CI, deployment and live runtime smoke checks.

## Safe decommission order

1. Keep Yandex deployment, runtime smoke and production monitoring green.
2. Remove client/runtime fallbacks to legacy providers.
3. Verify a real `main` deployment reaches `annword.ru` and `api.annword.ru` without legacy-provider involvement.
4. Remove legacy Vercel checks/workflows and verify another Yandex deployment.
5. Verify `annword.ru` DNS/domain routing is independent of Vercel.
6. Only then remove the Vercel project/tokens/integration and remaining legacy server code.
