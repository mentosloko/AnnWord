-- Speed up admin filtering of API request telemetry by recent time and release SHA.
create index if not exists analytics_events_performance_release_time_idx
  on public.analytics_events((payload->>'releaseSha'), occurred_at desc)
  where event_type = 'performance'
    and event_name in ('request_completed', 'request_failed')
    and coalesce(payload->>'releaseSha', '') <> '';
