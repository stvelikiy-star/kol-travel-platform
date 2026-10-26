# KÖL Winter Premium 3D — controlled integration (2026-10-26)

## Approved scope
- Existing Next.js repository and existing release branch only; do not create duplicate platforms or new databases.
- Preserve the approved four-scene interaction, 3D pointer tilt, image masks, existing colors, responsive behavior, and reduced-motion support.
- The Winter Premium 3D ZIP is a visual source package, NOT an application backend. Its demo auth/order/request pages MUST NOT replace real route handlers.
- Preserve routes `/login`, `/register`, `/client`, `/admin`, `/partner`, `/courier`, `/owner` and backend server actions / RLS logic.

## Source and destination mapping
| Visual source | Integration destination | Backend behavior |
|---|---|---|
| index.html / winter scenes | src/app/page.tsx and isolated client-side scene component | server catalog readers stay in use |
| stay.html | /stays and /stays/[slug] | existing catalog and booking actions |
| tours.html | /tours and /tours/[slug] | existing tours and booking actions |
| delivery.html | /delivery, /food, /shop | existing order and catalog actions |
| account.html | /login, /register, /client/profile | Supabase Auth, never demo success |
| request.html / orders.html | existing checkout / client routes | verified persistent writes / status |
| service.html | existing specific catalog detail routes | real IDs, prices, availability |
| winter .webp and 3D CSS/JS | public/kol-winter + React component/styles | client-only animation, no auth logic |

## Release guards
1. Record release SHA and preserve existing files before UI integration.
2. Import image assets with exact dimensions; verify paths and file bytes (no broken paths).
3. Retain server-side data reads and dynamic routing; no static fake prices or availability.
4. Run lint, TypeScript, build, unit checks, visual diff at 390 / 768 / 1440 px and reduced-motion.
5. Validate access by roles: client, admin/support, partner, courier, owner; attempt cross-account reads/writes and require denial.
6. Database: backup + successful restore FIRST, then planned migrations and tests. No direct production schema edits for UI work.
7. E2E: register/login -> client profile -> real request -> operator handling -> audit -> client status.
8. Production switch only on green CI, real seeded/verified catalog, HTTPS and rollback.

## Current verification limit
The static ZIP is available in this conversation but the connected GitHub contents API supports only UTF-8 file operations; binary WebP assets cannot be published through those methods in this session. Consequently, *this document is a gate, not proof that the Winter UI was deployed*. Do not mark the full integration complete until the actual assets and component are committed, built, and exercised.
