# Production verification checklist

After each Yandex production deployment from `main`:

1. Confirm the `Deploy to Yandex Cloud` workflow completed successfully.
2. Confirm the workflow ran PostgreSQL migrations.
3. Confirm the backend Serverless Container revision uses the merge commit SHA.
4. Confirm the frontend Object Storage upload completed.
5. Verify registration rejects a `.com` address with the Russian-domain explanation.
6. Verify Premium users see the `✦ Premium` indicator in the header/profile.
7. Verify `/api/health` and `/api/health/db` return success.
