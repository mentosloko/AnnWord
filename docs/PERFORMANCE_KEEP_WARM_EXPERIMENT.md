# Optional keep-warm experiment

Not enabled by this PR.

After cold/warm telemetry has collected enough production data, an external scheduler can call `/api/health/db` periodically to test whether ordinary invocations reduce user-visible cold starts without enabling paid prepared instances. The experiment should be evaluated by current-release cold-start share and p95, and removed if it does not materially improve them.

Because Yandex Serverless Containers keeps idle instances for a variable, undocumented duration and may route calls across availability zones, periodic pings are a best-effort experiment rather than a guarantee of a warm instance.
