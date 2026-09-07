# Manual Yandex Cloud smoke checklist

Use this checklist for release-level manual verification when a product change warrants browser or API smoke beyond the automated deployment gate.

## 1. Database migrations

Production migrations run through:

```bash
npm run db:yandex:migrate
```

The migration runner reads either `DATABASE_URL` or the `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` group.

## 2. Backend health

Check:

```text
/api/health
/api/health/db
/api/runtime-config
```

Expected:

```text
/api/health -> status ok
/api/health/db -> status ok, database.ok true
/api/runtime-config -> status ok
```

If `/api/health/db` fails, check the `DATABASE_URL` used by Serverless Container and the Yandex Cloud network path to Managed PostgreSQL.

## 3. Payments

When payment behavior changes, verify the Prodamus flow in the appropriate test/demo mode before a real payment check.

Expected:

```text
POST /api/payments/prodamus/create -> checkoutUrl returned
POST /api/payments/prodamus/notify -> OK for a valid signed paid notification
```

The paid notification must persist payment/webhook state and activate the expected Premium fields on the profile.

## 4. Family and teacher flows

Verify the relevant endpoints and UI flows for account mode, child profile setup, parent access and teacher linking when those areas change.

## 5. Release invariants

A release is healthy when:

```text
Yandex API health is green
Yandex DB health is green
frontend is served from Object Storage/CDN
email account flow uses the AnnWord backend
profile load/save uses the AnnWord backend
payment create/notify use the AnnWord backend
family/teacher flows use the AnnWord backend
```

The automated `Deploy to Yandex Cloud` workflow already verifies the release SHA, API/database health, CORS and static-delivery cache policy. This checklist is for additional manual product verification, not a second deployment system.
