# Production migration path

GitHub Actions cannot reach the private Managed PostgreSQL endpoint, so the deploy workflow keeps its migration step as a no-op in GitHub Actions. The backend image runs `db:yandex:migrate` before `api:start`; the migration runner holds a PostgreSQL advisory lock so concurrent cold starts cannot apply migrations simultaneously.
