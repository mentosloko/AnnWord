# First Yandex Cloud deploy runbook

This runbook covers the first safe deploy from branch `infra/ru-cloud-migration`.

The first deploy does **not** switch production traffic from Vercel/Supabase. It only verifies that the Yandex Cloud contour works:

- backend Docker image builds and is pushed to Yandex Container Registry;
- `annword-api-prod` receives a new Serverless Container revision;
- frontend `dist/` is uploaded to `annword-frontend-prod`;
- API health endpoint responds;
- API can connect to Yandex Managed PostgreSQL;
- email auth, Yandex OAuth, Prodamus callbacks, family/teacher routes are reachable through the new backend.

## GitHub Actions workflow

Workflow file:

```text
.github/workflows/yandex-deploy.yml
```

It runs on:

```text
workflow_dispatch
push to infra/ru-cloud-migration
```

Manual `workflow_dispatch` has an input:

```text
run_migrations=false | true
```

Use `run_migrations=true` only when the runner can reach Yandex Managed PostgreSQL. If the database has no public access, run migrations from an environment inside Yandex Cloud instead.

## Required GitHub Actions Secrets

```text
YC_SERVICE_ACCOUNT_KEY_JSON
YC_SERVICE_ACCOUNT_ID
YC_SERVERLESS_CONTAINER_ID
YC_REGISTRY_ID
YC_FOLDER_ID
YC_CLOUD_ID

DATABASE_URL
PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD

APP_URL
API_URL or YC_API_PUBLIC_URL
JWT_SECRET
COOKIE_SECRET

SESSION_SECRET
PRODAMUS_SECRET
YANDEX_CLIENT_ID
YANDEX_CLIENT_SECRET

S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_ENDPOINT
S3_FRONTEND_BUCKET
S3_ASSETS_BUCKET
```

Notes:

- `APP_URL` must be the public frontend URL.
- `API_URL` or `YC_API_PUBLIC_URL` must be the public API URL used by the frontend and OAuth callback.
- `DATABASE_URL` value must be only the PostgreSQL URL, without the `DATABASE_URL=` prefix. URL-encode the password before putting it into the URL if it contains punctuation or reserved URL characters.
- `JWT_SECRET` signs backend sessions.
- `COOKIE_SECRET` signs parent access PIN digests.
- `PRODAMUS_SECRET` is required before real paid checkout/webhook testing.
- `YANDEX_CLIENT_ID` and `YANDEX_CLIENT_SECRET` are required before Yandex OAuth testing.

## Yandex OAuth callback

In the Yandex OAuth application, configure callback URL:

```text
https://<public-api-url>/api/auth/yandex/callback
```

The same public API URL should be available as `API_URL` or `YC_API_PUBLIC_URL` in GitHub secrets and backend runtime env.

## Expected API endpoints

After a successful Serverless Container revision deploy:

```text
GET /api/health
GET /api/health/db
GET /api/runtime-config
```

Expected healthy responses:

```json
{"status":"ok","service":"annword-api"}
```

and for database:

```json
{"status":"ok","database":{"configured":true,"ok":true}}
```

Auth-protected endpoint smoke checks should return `401` before login:

```text
GET /api/profile/me
GET /api/profile/assigned-words
GET /api/mentor/learners
```

## Manual smoke after first deploy

1. Open frontend from Yandex Object Storage/custom domain.
2. Register/login by email.
3. Check that profile loads and stays loaded after refresh.
4. Create parent account and child access code.
5. Login as teacher, connect by child share code, assign a saved dictionary.
6. Login as learner/parent and verify assigned words appear in profile/dictionary counters and custom-word games.
7. Create Prodamus payment in demo mode.
8. Verify `urlNotification` points to:

```text
https://<public-api-url>/api/payments/prodamus/notify
```

9. Return from success/fail payment pages and verify SPA handles:

```text
/?payment=success&order_id=...
/?payment=fail&order_id=...
```

## Common failures

### `YC_SERVICE_ACCOUNT_ID` is present but deploy still fails auth

The workflow needs `YC_SERVICE_ACCOUNT_KEY_JSON`, not only `YC_SERVICE_ACCOUNT_ID`. The secret must contain the full JSON key.

### Docker push fails

Check that `annword-deploy-bot` has:

```text
container-registry.images.pusher
container-registry.images.puller
```

### Serverless deploy fails

Check that `annword-deploy-bot` has:

```text
serverless-containers.editor
```

and that `YC_SERVERLESS_CONTAINER_ID` points to `annword-api-prod`.

### Frontend upload fails

Check that:

```text
S3_ENDPOINT=https://storage.yandexcloud.net
S3_FRONTEND_BUCKET=annword-frontend-prod
```

and that static keys belong to a service account with Object Storage access.

### `/api/health/db` fails

Check:

```text
DATABASE_URL
PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD
```

For `DATABASE_URL`, encode the password for URL usage. For example, `@`, `#`, `%`, `&`, `/`, `:`, and `?` must not appear raw inside the password segment of the URL.

If PostgreSQL has no public access, GitHub Actions cannot connect directly from outside. Run migrations from an environment inside Yandex Cloud, then deploy with `run_migrations=false`.

### Email login works but authenticated API calls return `401`

This usually means frontend and API are on different sites and the browser is not sending the session cookie. During cutover, prefer same-site custom domains for frontend and API, or apply a local auth-token fallback patch before production cutover.

## Rollback

This branch does not change production DNS. Existing Vercel/Supabase production remains the rollback path until explicit cutover.
