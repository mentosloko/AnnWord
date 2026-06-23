# Yandex PostgreSQL migration notes

This document describes the new PostgreSQL schema used by the Yandex Cloud runtime.

## Why the schema is different from Supabase

Supabase stores identities in `auth.users` and app data in `public.profiles` with a foreign key to `auth.users`.

Yandex Managed PostgreSQL does not provide Supabase Auth, so AnnWord now needs its own identity table:

```text
public.app_users
```

The new `profiles.id` references `app_users.id` instead of `auth.users(id)`.

## Current migration files

```text
db/yandex/001_core_schema.sql
```

It creates:

```text
app_users
profiles
adult_learner_links
assigned_word_sets
premium_payments
```

and base functions:

```text
increment_coins
activate_paid_premium_payment
```

## Running migrations

From a machine that can reach Yandex Managed PostgreSQL:

```bash
npm run db:yandex:migrate
```

The command reads connection settings from `DATABASE_URL` or from `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.

If PostgreSQL public access is disabled, run the command from a temporary VM inside the same Yandex Cloud network or from another trusted internal execution environment.

## Auth migration strategy

For the first production migration:

1. Copy Supabase `public.profiles` data.
2. Create corresponding `app_users` rows with the same UUIDs where possible.
3. Mark migrated users as requiring a new password.
4. Ask the small number of real users to set a new password after cutover.
5. Keep old Supabase/Vercel as rollback until the new login path is verified.

## Important mapping

Supabase:

```text
auth.users.id -> public.profiles.id
```

Yandex:

```text
public.app_users.id -> public.profiles.id
```

Application code must not depend on `auth.uid()` anymore. Authorization is handled in the backend API by reading the signed AnnWord session and using `req.user.id` in database queries.
