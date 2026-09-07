# Prodamus Premium integration

AnnWord Premium payments run through the AnnWord backend deployed in Yandex Cloud.

## Plans

Current plan codes and prices are defined in `services/premiumPlanCatalog.ts`; treat that catalog as the application source of truth rather than duplicating values in deployment documentation.

## Required server environment

The Yandex Serverless Container deployment provides the payment configuration through server-side secrets/environment variables, including:

```bash
PRODAMUS_SECRET=<server-side secret>
PRODAMUS_PAYFORM_HOST=manto-school.payform.ru
PRODAMUS_DEMO_MODE=0
APP_URL=https://annword.ru
```

Never expose the signing secret through `VITE_*` variables or commit it to the repository.

## Prodamus URLs

The live AnnWord flow uses the application return URLs and the backend notification endpoint:

```text
Success: https://annword.ru/premium/success
Webhook: https://api.annword.ru/api/payments/prodamus/notify
```

Use the current Prodamus account configuration and backend implementation as the authoritative source if provider settings change.

## Flow

1. An authenticated user chooses a Premium plan.
2. Frontend calls `POST /api/payments/prodamus/create` through the AnnWord backend.
3. Backend creates the pending payment state in Yandex Managed PostgreSQL and returns a signed Prodamus checkout URL.
4. Browser redirects to Prodamus.
5. Prodamus sends a signed notification to `/api/payments/prodamus/notify`.
6. Backend verifies the signature and payment status.
7. A valid paid notification activates or extends Premium in Yandex Managed PostgreSQL.
8. Repeated notifications for the same provider order are handled idempotently and must not extend Premium twice.

## Verification checklist

When changing payment behavior:

- test checkout creation in the appropriate demo/test mode;
- verify the signed webhook path;
- confirm paid state is persisted;
- confirm `subscription_tier` and `premium_expires_at` update as expected;
- replay the same webhook and confirm idempotency;
- verify failed/cancelled payments do not activate Premium;
- run the normal CI and Yandex production deployment verification before a live payment check.

## Recurring payments later

Recurring payments are a separate product capability. If introduced, store the provider subscription lifecycle explicitly (subscription id/status, next charge, cancellation/refund state) and extend Premium only on confirmed successful charge events. Do not emulate recurring billing by silently creating a new one-time order every month.
