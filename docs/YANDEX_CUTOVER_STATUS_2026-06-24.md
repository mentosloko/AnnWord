# AnnWord Yandex Cloud cutover status — 2026-06-24

## Current production target

- Frontend: Yandex Object Storage static website bucket.
- Backend API: Yandex Serverless Container.
- Database: Yandex Managed PostgreSQL.
- Payments: Prodamus endpoint handled by the Yandex backend.
- App timezone: Europe/Moscow.

## Completed

- Yandex API backend added and deployed.
- Frontend build can use `VITE_API_URL` and communicate with the Yandex backend instead of Supabase/Vercel API routes.
- Yandex PostgreSQL schema was prepared for the migrated runtime tables.
- Supabase data migration was applied successfully via `Yandex Data Migration` workflow run `28105569183`.
- Migration result:
  - `auth.users -> app_users`: 26 selected / 26 written / 1 skipped.
  - `profiles`: 24 selected / 24 written / 1 skipped.
  - `dictionary_collections`: 6 / 6.
  - `adult_learner_links`: 2 / 2.
  - `assigned_word_sets`: 2 / 2.
  - `premium_payments`: 7 / 7.
  - `prodamus_webhook_events`: 3 / 3.
  - `daily_quests`: 45 / 45.
  - `game_events`: 1061 / 1061.
  - `analytics_events`: intentionally not migrated.
- Temporary profile JSON workaround was reverted in Yandex DB after migration: profile JSON-like fields should be `jsonb` again.
- A post-migration Yandex user created after the Yandex move was able to log in.

## Known limitations after migration

- Old Supabase password hashes were not copied into Yandex because auth migration was intentionally performed as user skeletons.
- Old users may need either Yandex OAuth with matching email, manual password reset SQL, or a future password recovery feature.
- The `main` branch has not yet been fast-forwarded to `infra/ru-cloud-migration`; GitHub force-update was blocked by the available tool. Until that is done, Yandex work continues from `infra/ru-cloud-migration`.
- The legacy Vercel API routes and Supabase fallback code still exist in the repository for rollback/local compatibility, but the Yandex production build should use `VITE_API_URL` and the Yandex backend.

## Recommended final manual cutover items

1. Point the real application domain to the Yandex frontend endpoint.
2. Point Prodamus callbacks to the Yandex backend endpoint.
3. After a stable observation window, remove Supabase migration secrets from Yandex deploy environment:
   - `SUPABASE_DATABASE_URL`
   - `ANNWORD_MIGRATION_SECRET`
4. After rollback window, pause/archive Supabase project only when no old rollback/login bridge is needed.
5. Fast-forward or merge `infra/ru-cloud-migration` into `main` through GitHub UI if the API tool keeps blocking force-update.

## Smoke checks to run after every Yandex deploy

- Open frontend home page from Yandex Object Storage.
- Register a new test user.
- Log in with that test user after logout.
- Load profile.
- Finish one game and check that profile/progress persists after refresh.
- Open daily quest and complete/refresh once.
- Open premium screen and verify Prodamus button state.
- Check backend health endpoints:
  - `/api/health`
  - `/api/health/db`
  - `/api/runtime-config`
