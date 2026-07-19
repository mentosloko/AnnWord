# AnnWord quick production benchmark

Measured: 2026-07-19T17:43:51.987725+00:00

## Curl

| Target | Median total | p95 total | Median TTFB | p95 TTFB | Size |
|---|---:|---:|---:|---:|---:|
| api_health | 883.3 ms | 1018.8 ms | 883.2 ms | 1018.7 ms | 122 B |
| api_health_db | 630.1 ms | 948.4 ms | 630.0 ms | 948.3 ms | 133 B |
| api_profile_bootstrap_unauth | 879.5 ms | 982.8 ms | 879.3 ms | 982.6 ms | 24 B |
| api_runtime_config | 616.2 ms | 787.5 ms | 616.1 ms | 787.4 ms | 187 B |
| api_weekly_status | 670.7 ms | 994.3 ms | 670.5 ms | 994.2 ms | 173 B |
| page_kids | 830.7 ms | 1188.6 ms | 830.6 ms | 1188.4 ms | 2396 B |
| page_practice | 828.9 ms | 897.8 ms | 828.8 ms | 897.7 ms | 2396 B |
| page_premium | 811.0 ms | 929.6 ms | 810.8 ms | 929.5 ms | 2396 B |
| page_profile | 833.5 ms | 893.0 ms | 833.3 ms | 892.9 ms | 2396 B |
| page_root | 618.3 ms | 1018.9 ms | 618.2 ms | 1018.8 ms | 2396 B |

## Lighthouse root

| Mode | Score | FCP | LCP | Speed Index | TBT | CLS | TTFB | Bytes | Requests |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mobile | 66 | 5033 ms | 5033 ms | 6444 ms | 70 ms | 0 | 231 ms | 1808007 | 30 |
| desktop | 70 | 2074 ms | 2074 ms | 2346 ms | 0 ms | 0.166 | 218 ms | 1808008 | 30 |
