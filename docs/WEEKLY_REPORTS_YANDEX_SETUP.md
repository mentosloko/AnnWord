# Weekly reports in Yandex Cloud

AnnWord sends parent reports through Yandex Cloud Postbox from the existing Serverless Container. No static Postbox access key is stored in the application: the container requests a short-lived IAM token for its attached service account.

## Required configuration

1. In Yandex Cloud Postbox, create and verify the sender address or sender domain in the same folder as the Serverless Container service account.
2. Grant the service account attached to the AnnWord Serverless Container the `postbox.sender` role.
3. Add GitHub Actions repository secrets:
   - `WEEKLY_REPORT_FROM_EMAIL` — verified sender, for example `reports@annword.ru`;
   - `WEEKLY_REPORT_CRON_SECRET` — a long random secret used only by the timer trigger.
4. Run a normal production deployment so the two variables are injected into the new container revision.
5. Create a Yandex Cloud timer trigger that sends a `POST` request every Monday to:
   - `https://api.annword.ru/api/reports/weekly/run`
   - JSON body: `{ "secret": "<WEEKLY_REPORT_CRON_SECRET>" }`
6. Ensure the service account used by the trigger is allowed to invoke the AnnWord container.

Recommended schedule: Monday morning in Moscow time, after the previous week is complete.

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
2. Invoke the runner endpoint once manually with the cron secret.
3. Confirm the response contains `sent: 1` or a clear per-profile error.
4. Confirm the message appears in Postbox delivery history and in the destination mailbox.
5. Confirm `/api/runtime-config` returns `hasWeeklyReports: true`.
