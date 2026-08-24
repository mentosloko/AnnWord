# API performance observability

The admin API speed block records client-observed request duration and Server-Timing metadata.

- `coldStart=true` means the request was the first request handled by that Node process.
- `coldStart=false` means the process had already handled at least one request.
- `releaseSha` is the first 12 characters of the deployed `RELEASE_SHA`.
- Deduplicated client-side joins do not inherit cold/warm or release metadata and therefore stay only in the unfiltered aggregate.
- Historical measurements created before this telemetry was deployed have neither cold/warm nor release metadata.

The admin screen can filter the performance table by the last 1/3/7/14/30/90 days, release SHA, and cold/warm state. Cold and warm p95 values are shown separately per API route.

Production PostgreSQL migrations remain skipped inside GitHub Actions because the database is private. The backend container runs the migration command before starting the API. A PostgreSQL advisory lock serializes migrations if multiple container instances start concurrently.
