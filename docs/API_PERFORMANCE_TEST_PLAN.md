# Post-deploy API performance verification

After deployment:

1. Confirm the release SHA is visible in the admin API speed filter.
2. Confirm new rows have cold/warm attribution.
3. Compare 1-day and 3-day p95 values for the current release only.
4. Compare cold p95 vs warm p95 for `/api/profile/bootstrap`, `/api/profile/stats`, `/api/profile/game-result`, and `/api/daily-quest/today`.
5. Verify `annword_schema_migrations` contains both 2026-08-24 performance index migrations.
6. Verify `assigned_word_sets_learner_active_cover_idx` is absent and `assigned_word_sets_learner_active_idx` is present.
7. Verify production runtime DDL remains disabled.

Interpretation:

- cold p95 much larger than warm p95 => cold-start path is a major contributor;
- warm p95 still several seconds => focus next on database/network/pool timings rather than frontend payload;
- both low but client p95 high => inspect client retries, browser/network, and timeout telemetry.
