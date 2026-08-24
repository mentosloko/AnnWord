# Release SHA telemetry

The API includes the first 12 characters of `RELEASE_SHA` in Server-Timing metadata. The client records it into performance analytics so admin p95 can be filtered to one deployed release instead of mixing several versions in a rolling window.
