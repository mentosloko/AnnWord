# First Yandex Cloud deploy runbook

This runbook covers the first safe deploy from branch `infra/ru-cloud-migration`.

The first deploy does **not** switch production traffic from Vercel/Supabase. It only verifies that the Yandex Cloud skeleton works:

- backend Docker image builds and is pushed to Yandex Container Registry;
- `annword-api-prod` receives a new Serverless Container revision;
- frontend `dist/` is uploaded to `annword-frontend-prod`;
- API health endpoint responds;
- API can connect to Yandex Managed PostgreSQL.

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

SESSION_SECRET
JWT_SECRET
COOKIE_SECRET

PRODAMUS_SECRET
YANDEX_CLIENT_ID
YANDEX_CLIENT_SECRET

S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_ENDPOINT
S3_FRONTEND_BUCKET
S3_ASSETS_BUCKET
```

Optional, but recommended before real frontend/API integration:

```text
APP_URL
API_URL
YC_API_PUBLIC_URL
```

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

If PostgreSQL has no public access, the Serverless Container still may connect depending on network/service settings, but GitHub Actions cannot connect directly from outside. The first skeleton does not run DB migrations from GitHub Actions yet.

## Rollback

This branch does not change production DNS. Existing Vercel/Supabase production remains the rollback path until explicit cutover.
