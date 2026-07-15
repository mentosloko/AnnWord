# Weekly reports in Yandex Cloud

AnnWord sends parent reports through Yandex Cloud Postbox from the existing Serverless Container. No static Postbox access key is stored in the application: the container requests a short-lived IAM token for its attached service account.

## Required configuration

1. In Yandex Cloud Postbox, create and verify the sender address or sender domain in the same folder as the Serverless Container service account.
2. Grant the service account attached to the AnnWord Serverless Container the `postbox.sender` role.
3. Add GitHub Actions repository secrets:
   - `WEEKLY_REPORT_FROM_EMAIL` — verified sender, for example `reports@annword.ru`;
   - `WEEKLY_REPORT_CRON_SECRET` — a long random value used to protect the report runner endpoint.
4. Run a normal production deployment so the variables are injected into the new container revision.

The repository workflow `Weekly Parent Reports` invokes the protected Yandex API every Monday at 06:00 UTC (09:00 Moscow). It performs one cURL request, has a three-minute timeout and exits without error while `WEEKLY_REPORT_CRON_SECRET` is not configured.

No Yandex Timer Trigger or additional function is required.

## Runtime behavior

- Only parent profiles with active Kids Premium and a saved report email are included.
- Report addresses are limited to `.ru` and `.рф` domains.
- The report covers the previous complete Monday–Sunday period.
- Delivery is idempotent by profile and week. A successful report is not sent twice on retry.
- Delivery results are stored in `weekly_report_delivery_log`.
- Parents can change the address or disable reports from the parent cabinet.

## Operational check

After configuration:

1. Save a report email in a Premium parent profile.
2. Run GitHub Actions workflow `Weekly Parent Reports` manually once.
3. Confirm the response contains `sent: 1` or a clear per-profile error.
4. Confirm the message appears in Postbox delivery history and in the destination mailbox.
5. Confirm `/api/runtime-config` returns `hasWeeklyReports: true`.
