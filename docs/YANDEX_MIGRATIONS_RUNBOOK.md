# Yandex DB migrations runbook

The Yandex API container no longer runs database migrations on every cold start. Running migrations during cold start made the first user request slow and could produce transient cancelled requests during initialization.

Current policy:

1. The API container starts the server directly.
2. SQL migrations live in `db/yandex`.
3. Run migrations manually only when a new migration file is added.
4. After migrations are applied, deploy the backend container revision.

Recommended places to run migrations:

- a local machine with network access to the Yandex PostgreSQL cluster;
- a small Yandex VM or self-hosted runner inside the correct network;
- a temporary controlled maintenance job.

Do not re-enable automatic migrations on every serverless container cold start unless the startup latency tradeoff is explicitly accepted.
