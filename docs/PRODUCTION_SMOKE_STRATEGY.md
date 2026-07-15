# Production smoke strategy

The goal is to catch release regressions without running a full browser matrix on every commit.

## Level 1 — deployment verification on every production release

The Yandex deployment workflow already performs inexpensive checks after publishing:

- exact frontend release SHA;
- API health;
- rejection of a foreign registration email.

This uses shell and cURL only and adds little runtime compared with the deployment itself.

## Level 2 — manual quick smoke after meaningful releases

Run GitHub Actions workflow `Production Smoke` with suite `quick`.

It checks:

- frontend and API availability;
- all public and internal SPA URLs;
- that each route returns the application shell;
- foreign-email registration rejection.

The workflow does not install dependencies or a browser and has a three-minute timeout. It is intended for releases that change routing, auth, payments, persistence or deployment infrastructure.

## Level 3 — manual browser smoke for large product changes

Run `Production Smoke` with suite `browser`.

It first runs the quick checks, then installs Chromium and executes the small Playwright role-entry suite against production. Browser traces, screenshots and video are retained only for failures.

Use this for:

- onboarding changes;
- account-role changes;
- major navigation redesigns;
- Premium/payment changes;
- large game-shell or authentication changes;
- release candidates before a marketing launch.

## Not recommended

Do not run the full Playwright matrix on every small pull request. Installing several browsers consumes substantially more time than lint, unit tests and build, while most small regressions are already covered by unit and static smoke tests.

## Future improvement

Issue #57 tracks recorded end-to-end user journeys with browser console logs, network failures, traces and videos. That exercise should be periodic or release-based rather than mandatory on every commit.
