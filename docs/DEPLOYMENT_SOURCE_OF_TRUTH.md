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

`main` → `.github/workflows/yandex-deploy.yml` → Yandex Container Registry / Serverless Container / Object Storage.

- `.github/workflows/ci.yml` validates changes but does not deploy production.
- `.github/workflows/yandex-deploy.yml` publishes both frontend and backend, runs PostgreSQL migrations for pushes to `main`, and verifies the live release SHA, API/database health, CORS and static-delivery cache policy before reporting `Yandex Production` success.
- `.github/workflows/production-operations.yml` is retired. GitHub Actions no longer polls production availability or re-applies Managed PostgreSQL backup settings on a schedule or after deployments.
- Infrastructure monitoring and managed PostgreSQL backups remain owned by Yandex Cloud. AnnWord does not add a second recurring GitHub-hosted monitoring layer.
- `.github/workflows/weekly-reports.yml` remains a dedicated product scheduler because it sends configured parent reports; it is not an infrastructure health monitor.
- Full browser production smoke is release-based/manual rather than an automatic post-deploy gate.
- The former `yandex-smoke.yml` and `production-performance-evidence.yml` workflows are retired; their overlapping or brittle post-deploy checks must not be reintroduced as mandatory CI/CD gates. RUM collection and performance data may still be queried independently when analysis is needed.

Repo-owned Vercel deployment, production-verification and preview-promotion workflows have been retired. `vercel.json` sets `git.deploymentEnabled` to `false`, so the remaining detached Vercel project must not create deployments from Git pushes or pull requests. The Vercel project has no AnnWord custom production domains; only `*.vercel.app` aliases remain.

The Vercel project itself may remain temporarily as an inert external resource. Automated deletion from GitHub is not available because no repository Vercel API token is configured; this does not affect the Yandex deployment chain.

## Runtime dependency rule

Client production services must use the AnnWord backend API (`api.annword.ru` in production). They must not import or call the Supabase client as a runtime fallback.

Legacy Supabase/Vercel code may remain temporarily only when needed to retire old infrastructure safely. It must be removed in separate cleanup steps after the Yandex-only path has passed CI and deployment verification.

## Safe decommission order

1. Keep the built-in Yandex deployment verification green.
2. Remove client/runtime fallbacks to legacy providers.
3. Verify a real `main` deployment reaches `annword.ru` and `api.annword.ru` without legacy-provider involvement.
4. Remove repo-owned legacy-provider checks/workflows and verify another Yandex deployment.
5. Keep production infrastructure monitoring and backups in Yandex Cloud rather than duplicating them in GitHub Actions.
