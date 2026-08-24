# API performance correctness pass — 2026-08-24

Scope approved for this pass:

- restore a guaranteed production migration path for the private Yandex PostgreSQL database without re-enabling request-time/runtime DDL;
- replace the unsafe assignment covering index that stored the unbounded `words` array;
- tag API request telemetry with cold/warm process state and release SHA;
- add admin filters for API performance by time window, release SHA, and cold/warm state;
- expose cold and warm p95 separately per route.

No Yandex Cloud scaling, prepared instance, CPU, RAM, database tier, pooling mode, CDN, or other paid infrastructure setting is changed by this work.
