# Production deployment regression — 2026-07-14

The P0/P1 feature PR was merged into `main` and passed CI, but `annword.ru` did not receive those changes because the Yandex Cloud deployment workflow still listened only to `infra/ru-cloud-migration`.

Impact:
- old frontend remained in Yandex Object Storage;
- old backend remained in Yandex Serverless Container;
- Gmail registration was still accepted;
- Premium indicators and other merged UI/backend changes were absent.

Fix:
- make `main` the Yandex production deployment branch;
- run idempotent PostgreSQL migrations on each production push;
- keep CI and Vercel as validation, not production-release evidence.
