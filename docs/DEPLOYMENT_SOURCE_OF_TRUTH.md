# AnnWord production deployment source of truth

- Production frontend: Yandex Object Storage.
- Production backend: Yandex Serverless Container.
- Production branch: `main`.
- `.github/workflows/ci.yml` validates changes but does not deploy production.
- `.github/workflows/yandex-deploy.yml` publishes both frontend and backend and runs PostgreSQL migrations for pushes to `main`.
- Vercel deployments are previews/secondary verification and must not be treated as proof that `annword.ru` is updated.
