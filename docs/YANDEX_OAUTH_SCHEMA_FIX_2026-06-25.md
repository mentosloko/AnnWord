# Yandex OAuth schema fix — 2026-06-25

The Yandex PostgreSQL schema must include `public.app_users.yandex_id` for the backend Yandex OAuth callback to link or create users.

The fix is implemented as an idempotent Yandex DB migration:

- `db/yandex/006_yandex_oauth_app_users.sql`

The GitHub-hosted runner cannot resolve the private Yandex PostgreSQL hostname, so migrations must not be run directly from GitHub Actions. They are applied inside the Yandex API container by `scripts/start-yandex-api.sh` before `npm run api:start`.

Expected OAuth path after deploy:

1. User clicks Yandex login.
2. Yandex redirects to `/api/auth/yandex/callback` on the Yandex API container.
3. Backend links by `yandex_id` or email.
4. Backend issues AnnWord session and redirects back to the app.
