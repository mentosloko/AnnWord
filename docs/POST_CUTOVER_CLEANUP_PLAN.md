# AnnWord post-cutover cleanup plan

This document tracks cleanup after the move from Vercel/Supabase runtime to Yandex Cloud.

## Current Yandex runtime

- Frontend: Yandex Object Storage static website.
- Backend: Yandex Serverless Container.
- Database: Yandex Managed PostgreSQL.
- Production branch for Yandex work: `infra/ru-cloud-migration`.

## Keep temporarily

Keep these for the rollback window only:

- Vercel project and old API routes.
- Supabase project.
- Supabase schema/migrations in the repository.

Recommended rollback window: 7-14 days after successful Yandex smoke tests and Prodamus test payment.

## Disable migration access

The migration endpoint is protected by an environment secret. To disable it without code changes:

1. Delete or blank the GitHub Actions secret `ANNWORD_MIGRATION_SECRET`.
2. Delete or blank the GitHub Actions secret `SUPABASE_DATABASE_URL`.
3. Run `Deploy to Yandex Cloud` from `infra/ru-cloud-migration`.
4. Confirm that `/api/admin/migration/supabase` is no longer usable.

The backend authorization check requires the migration secret to be present. Without it, the endpoint responds as not found.

## Supabase retirement

Do not pause Supabase immediately if old user recovery is still needed.

Suggested order:

1. Finish user recovery plan for migrated users.
2. Export a final Supabase backup.
3. Remove Supabase migration secrets from Yandex deploy.
4. Keep Supabase read-only/idle for the rollback window.
5. Pause/archive Supabase only after production is stable.

## Vercel retirement

Vercel is not required by the Yandex production runtime. Keep it only as a rollback/preview source during the observation window.

Suggested order:

1. Confirm Yandex frontend and backend smoke checks pass.
2. Confirm Prodamus demo payment and webhook pass.
3. Confirm daily quest and game progress persist in Yandex DB.
4. Disable Vercel auto-deploys or leave the project idle as rollback.
5. Delete old Vercel-only API routes in a dedicated cleanup PR.

## Vercel API cleanup candidates

The Yandex runtime uses `server/yandex-api.ts` and routes under `server/routes/*`.

Legacy Vercel candidates to remove after the rollback window:

- `api/auth/yandex.ts`
- `api/debug/*`
- `api/payments/prodamus/*`
- `api/reports/weekly.ts`
- `api/_lib/*`
- `api/payments/_lib/*`
- `vercel.json`
- Vercel redeploy trigger files such as `.vercel-redeploy` and other one-off hotfix trigger files.

Do not remove these until rollback is no longer needed.

## Assets

Current Yandex deploy uploads the built frontend `dist` directory to `S3_FRONTEND_BUCKET` with `--delete`.

The app also supports `VITE_ASSETS_BASE_URL`, but the current Yandex workflow does not set it. Therefore static assets bundled by Vite are served from the frontend bucket. A separate assets CDN/bucket can be introduced later, but it is not required for launch.

## Old user recovery

Current safe recovery path for migrated users:

- If the user has a Yandex account with the same email, use `Войти через Яндекс`.
- The Yandex OAuth handler matches existing users by `yandex_id` or by email and links the Yandex identity to the existing migrated user record.

Remaining product task:

- Add authenticated password setup/change after Yandex login, or add a proper email reset flow once an email provider is connected.
