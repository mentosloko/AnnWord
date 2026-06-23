# Manual Yandex Cloud smoke checklist

Use this checklist after the first Yandex deploy and before switching any production DNS.

## 1. Apply database migrations

Run from an environment that can reach Yandex Managed PostgreSQL:

```bash
npm install
npm run db:yandex:migrate
```

The migration runner reads either `DATABASE_URL` or the `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` group.

Expected output:

```text
apply 001_core_schema.sql
apply 002_prodamus_webhook_events.sql
apply 003_account_fields.sql
apply 004_runtime_indexes.sql
Yandex PostgreSQL migrations applied.
```

## 2. Check backend health

Open:

```text
/api/health
/api/health/db
/api/runtime-config
```

Expected:

```text
/api/health -> status ok
/api/health/db -> database ok
/api/runtime-config -> hasDatabase true
```

If `/api/health/db` fails, first check the exact `DATABASE_URL` used by Serverless Container and whether the database cluster allows the container to connect.

## 3. Check payment skeleton

Before enabling real payments, use Prodamus demo mode.

Expected:

```text
POST /api/payments/prodamus/create -> checkoutUrl returned
POST /api/payments/prodamus/notify -> OK for a valid signed paid notification
```

Payment notification must write to:

```text
premium_payments
prodamus_webhook_events
```

and paid notification must activate:

```text
profiles.subscription_tier = premium
profiles.premium_expires_at is not null
profiles.feature_flags.premiumDictionaries = true
profiles.feature_flags.adultRoom = true
```

## 4. Check family skeleton

Expected backend endpoints:

```text
POST /api/family/account-mode
POST /api/family/child
POST /api/family/access-check
```

Expected database writes:

```text
profiles.role
profiles.account_mode
profiles.child_display_name
profiles.child_share_code
profiles.access_digest
```

## 5. Cutover blockers

Do not switch production DNS until these are true:

```text
Yandex API health is green
Yandex DB health is green
frontend build is uploaded to Object Storage
email account flow is wired to backend API
profile load/save uses backend API
payment create and notify work through backend API
family/teacher flows work through backend API
```

## 6. Rollback

Until explicit cutover, keep the old Vercel/Supabase stack available. DNS should remain on the old stack until all smoke checks pass.
