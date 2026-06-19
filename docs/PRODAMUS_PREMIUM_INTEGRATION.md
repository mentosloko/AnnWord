# Prodamus Premium integration

Branch: `feature/prodamus-premium-payments`

This branch adds a non-production implementation path for one-time AnnWord Kids Premium payments through Prodamus.

## Plans

- `kids_month`: 1 month, 300 RUB, 31 days
- `kids_year`: 1 year, 3000 RUB, 365 days

No recurring payments are enabled in this branch.

## Required Vercel environment variables

Add these in Vercel Project Settings → Environment Variables for the Preview environment first:

```bash
PRODAMUS_PAYFORM_HOST=manto-school.payform.ru
PRODAMUS_SECRET_KEY=<add in Vercel, do not commit or paste into chat>
PRODAMUS_APP_URL=https://<preview-or-production-domain>
VITE_ENABLE_PRODAMUS_PAYMENTS=true
```

The existing server-side Supabase variables must also be present for Vercel functions:

```bash
VITE_SUPABASE_URL=<supabase-project-url>
SUPABASE_SERVICE_ROLE_KEY=<add in Vercel only>
```

Optional variables:

```bash
PRODAMUS_SIGNATURE_FORMAT=hex
PRODAMUS_REQUIRE_WEBHOOK_SIGNATURE=true
PRODAMUS_PAID_STATUSES=success,paid,completed,complete,confirmed,authorized
```

Use Preview env while testing. Add the same variables to Production only when the demo flow is fully verified and the branch is merged.

## Prodamus URLs

Set in Prodamus personal account / payment form settings:

```text
Success URL:  https://<domain>/payment/success
Return/Fail:   https://<domain>/payment/fail
Webhook URL:  https://<domain>/api/payments/prodamus/webhook
```

The create-payment endpoint also sends these URLs when it builds the payform checkout URL.

## Flow

1. Logged-in user opens Premium screen.
2. User chooses 1 month or 1 year.
3. Frontend calls `POST /api/payments/prodamus/create` with Supabase Bearer token.
4. Vercel function creates a `premium_payments` row with status `pending`.
5. Vercel function builds a signed payform URL for `manto-school.payform.ru` and returns it.
6. Browser redirects to Prodamus.
7. Prodamus sends payment webhook to `/api/payments/prodamus/webhook`.
8. Webhook verifies the signature and paid status.
9. Webhook calls `activate_paid_premium_payment` in Supabase.
10. Supabase extends `premium_expires_at`, sets `subscription_tier = premium`, and enables `featureFlags.premiumDictionaries` plus `featureFlags.adultRoom`.

Activation is idempotent: repeated paid webhooks for the same `provider_order_id` do not extend Premium twice.

## Demo-payment checklist

- Apply migration `20260619110000_prodamus_premium_payments.sql` to the test Supabase project.
- Add Vercel Preview env variables.
- In Prodamus, point demo webhook to the Vercel preview URL.
- Create a new logged-in parent account.
- Buy `kids_month` with demo payment.
- Confirm `premium_payments.status = paid`.
- Confirm `profiles.subscription_tier = premium` and `premium_expires_at` is set.
- Trigger the same webhook twice and confirm the expiry is not extended twice.
- Test failed/cancelled payment and confirm Premium is not activated.

## Recurring payments later

For v1 this branch uses one-time payments only. To add recurring payments later:

1. Add `subscription_id`, `subscription_status`, `next_charge_at`, `cancelled_at` to a separate `premium_subscriptions` table.
2. Create a Prodamus recurring/recurrent product in the Prodamus account.
3. Store the provider subscription id from the first successful payment.
4. Handle separate webhook events for recurrent charge success, charge failure, cancellation, and refund.
5. Extend Premium only on successful charge webhook.
6. Add an account UI button to cancel recurring access.
7. Keep one-time payments available as a fallback.

Do not implement recurring payments by simply creating a new one-time order every month. The provider subscription id and cancellation lifecycle must be stored explicitly.
