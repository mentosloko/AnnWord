# Yandex PostgreSQL schema and migrations

This document describes the PostgreSQL schema used by the Yandex Cloud runtime.

## Identity model

AnnWord owns its identity table:

```text
public.app_users
```

`profiles.id` references `app_users.id`. Authentication and authorization are handled by the AnnWord backend using the signed session and `req.user.id`; application code does not depend on database-provider auth helpers.

## Current migration files

Authoritative schema changes live under:

```text
db/yandex/*.sql
```

The base schema includes application identities and profiles together with the family, teacher, Premium, analytics, game and reporting tables required by the current backend.

## Running migrations

From an environment that can reach Yandex Managed PostgreSQL:

```bash
npm run db:yandex:migrate
```

The command reads connection settings from `DATABASE_URL` or from `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.

If PostgreSQL public access is disabled, run the command from an execution environment inside the same Yandex Cloud network or another trusted environment with database access.

## Production rule

`db/yandex/*.sql` together with `scripts/yandex-db-migrate.ts` are the only supported database migration path. Historical cross-provider migration tooling is retired and must not be reintroduced into the production runtime.
