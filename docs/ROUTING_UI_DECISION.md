# Routing and public product entry

## Public positioning

- `/` is the primary AnnWord landing page for parents. Its only registration CTA creates the Kids/parent flow.
- `/teacher` is the separate professional landing for teachers and creates a teacher account flow.
- `/kids` remains a valid Kids entry and canonical authenticated home for parent accounts.
- `/practice` is legacy login-only entry for existing player accounts. It must not advertise or create new player accounts.
- `/landing-mix` is legacy and normalizes to `/`.

## Account-mode safety

- New generic registrations default to `accountMode=parent`.
- Explicit `/teacher` registration resolves to `accountMode=teacher`.
- Existing `accountMode=player` profiles remain player profiles and must never be silently migrated to parent.
- Authenticated users always resolve to the canonical home for their stored account mode: parent → `/kids`, teacher → `/teacher`, player → `/practice`.
- Product-entry mapping must stay centralized in `services/productEntry.ts`; UI components must not invent their own parallel mode mapping.

## UI constraints

- The root landing must not show a three-mode chooser or public Practice offer.
- Teacher is reachable from the guest header through the separate `Преподавателям` link, not as a competing primary CTA.
- Dictionary word counts are not shown in selectors, Premium marketing, setup screens, profile summary, or in-game dictionary headers.
