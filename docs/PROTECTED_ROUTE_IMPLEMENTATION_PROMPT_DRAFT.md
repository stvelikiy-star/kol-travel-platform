# Protected Route Implementation Prompt Draft

Stage: 12P-3 - Protected Route Implementation Prompt Draft.

This document contains a future Codex prompt draft for implementing protected routes later. Do not implement protected routes now, do not create middleware, do not connect Supabase Auth, and do not change UI behavior in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Future Codex Prompt Draft

Use this prompt only after Supabase Auth test users, profile records and auth helpers are ready.

```text
STAGE 12P-FUTURE - PROTECTED ROUTE IMPLEMENTATION

Project: KOL / Issyk-Kul Travel & Delivery Platform.

Task:
Implement protected route checks for internal dashboard areas.

Pre-implementation requirements:

- Supabase test project is ready.
- Supabase Auth test users exist.
- Profile records exist.
- Auth helpers exist.
- Role helpers exist.
- Ownership helpers are planned.
- Rollback path is ready.
- Local demo mode still works.

Protected route goal:

- Protect internal dashboards by role.
- Keep public catalog pages open.
- Prevent wrong-role access.
- Avoid local development lockout.
- Keep server actions protected separately.

Public routes must remain public:

- /
- /tours
- /tours/[slug]
- /stays
- /stays/[slug]
- /food
- /food/[restaurantSlug]
- /shop
- /shop/[shopSlug]
- /partners
- /contacts
- /cart
- /checkout
- /booking/checkout
- /order/success
- /booking/success
- /design-system if needed for development

Protected route matrix:

/client/**

- client allowed
- admin allowed for support/debug
- super_admin allowed
- partner denied
- courier denied

/partner/**

- partner allowed
- admin allowed for support/debug
- super_admin allowed
- client denied
- courier denied

/courier/**

- courier allowed
- admin allowed for support/debug
- super_admin allowed
- client denied
- partner denied

/admin/**

- admin allowed
- super_admin allowed
- client denied
- partner denied
- courier denied

Auth redirect plan:

- unauthenticated user trying protected page goes to /login
- authenticated wrong-role user goes to /not-authorized
- blocked/inactive profile goes to /account-blocked or safe error page
- missing profile goes to /profile-required or safe error page

Do not implement these pages unless explicitly requested in the implementation stage.

Implementation approach:

- Prefer route group layouts with server-side checks first.
- Avoid aggressive middleware until auth is stable.
- Keep demo bypass flag for local development only if needed.
- Server actions must still re-check role and ownership.

Possible future environment flag:

- AUTH_PROTECTION_ENABLED=false by default during local planning
- set true only when test users exist

Do not add this env flag unless explicitly requested in the implementation stage.

Future files that may be changed:

- src/app/client/layout.tsx or route group layout
- src/app/partner/layout.tsx or route group layout
- src/app/courier/layout.tsx or route group layout
- src/app/admin/layout.tsx or route group layout
- src/lib/auth/session.ts
- src/lib/auth/profile.ts
- src/lib/auth/roles.ts
- src/lib/auth/errors.ts
- optional middleware.ts later

Protected route logic:

For each protected layout:

- get current session
- load profile
- check profile status
- check role
- allow admin/super_admin override where intended
- redirect safely if denied
- never expose raw Supabase/auth errors

Server action rule:

Even if route is protected, every real server action must still:

- verify session
- verify role
- verify ownership
- validate action
- create audit log if needed
- return safe result

Ownership note:

Route protection alone is not enough.

Examples:

- partner can enter /partner, but partner must still not access another partner's order
- courier can enter /courier, but courier must still not access another courier's delivery
- client can enter /client, but client must still not access another client's order

Testing checklist:

- unauthenticated /client redirects
- unauthenticated /partner redirects
- unauthenticated /courier redirects
- unauthenticated /admin redirects
- client can access /client
- client cannot access /partner /courier /admin
- partner can access /partner
- partner cannot access /client /courier /admin
- courier can access /courier
- courier cannot access /client /partner /admin
- admin can access /admin and support internal dashboards
- super_admin can access all protected areas
- public pages still work
- npm run build passes

Rollback:

- disable future AUTH_PROTECTION_ENABLED if used
- revert protected layouts
- keep DATA_SOURCE_MODE=mock
- keep demo pages accessible
- run npm run build
- restart dev server

Security:

- no service role key in client components
- no raw auth errors in UI
- no real credentials in repo
- .env.local not committed
- RLS still required
- server-side checks still required

Alcohol compliance:

- ALCOHOL_MODULE_ENABLED=false
- protected routes must not enable alcohol module
- auth roles cannot enable alcohol module
- AI cannot enable alcohol module
- partner/courier/admin cannot enable alcohol
- super_admin cannot activate alcohol without legal review, licensing and partner verification
- alcohol-related request is critical risk

Final report:

- protected route checks implemented
- public pages remain public
- role matrix verified
- rollback path kept
- build result
- errors if any
```

## 1. Pre-Implementation Requirements

- Supabase test project is ready.
- Supabase Auth test users exist.
- Profile records exist.
- Auth helpers exist.
- Role helpers exist.
- Ownership helpers are planned.
- Rollback path is ready.
- Local demo mode still works.

## 2. Protected Route Goal

- Protect internal dashboards by role.
- Keep public catalog pages open.
- Prevent wrong-role access.
- Avoid local development lockout.
- Keep server actions protected separately.

## 3. Public Routes

These must remain public:

- `/`
- `/tours`
- `/tours/[slug]`
- `/stays`
- `/stays/[slug]`
- `/food`
- `/food/[restaurantSlug]`
- `/shop`
- `/shop/[shopSlug]`
- `/partners`
- `/contacts`
- `/cart`
- `/checkout`
- `/booking/checkout`
- `/order/success`
- `/booking/success`
- `/design-system` if needed for development

## 4. Protected Route Matrix

### `/client/**`

- `client` allowed.
- `admin` allowed for support/debug.
- `super_admin` allowed.
- `partner` denied.
- `courier` denied.

### `/partner/**`

- `partner` allowed.
- `admin` allowed for support/debug.
- `super_admin` allowed.
- `client` denied.
- `courier` denied.

### `/courier/**`

- `courier` allowed.
- `admin` allowed for support/debug.
- `super_admin` allowed.
- `client` denied.
- `partner` denied.

### `/admin/**`

- `admin` allowed.
- `super_admin` allowed.
- `client` denied.
- `partner` denied.
- `courier` denied.

## 5. Auth Redirect Plan

Future behavior:

- unauthenticated user trying protected page goes to `/login`;
- authenticated wrong-role user goes to `/not-authorized`;
- blocked/inactive profile goes to `/account-blocked` or safe error page;
- missing profile goes to `/profile-required` or safe error page.

Do not implement these pages in this stage unless a future implementation prompt explicitly asks.

## 6. Future Implementation Approaches

Possible approaches:

- route group layouts with server-side checks;
- middleware for broad route protection;
- server component checks in dashboard layouts;
- server actions still re-check role and ownership.

Recommended safer first implementation:

- protect route group layouts first;
- avoid aggressive middleware until auth is stable;
- keep demo bypass flag for local development only if needed.

## 7. Future Environment Safety

Possible future flag:

- `AUTH_PROTECTION_ENABLED=false` by default during local planning;
- set true only when test users exist.

Do not add this env flag now. Document only.

## 8. Future Files That May Be Changed Later

- `src/app/client/layout.tsx` or route group layout
- `src/app/partner/layout.tsx` or route group layout
- `src/app/courier/layout.tsx` or route group layout
- `src/app/admin/layout.tsx` or route group layout
- `src/lib/auth/session.ts`
- `src/lib/auth/profile.ts`
- `src/lib/auth/roles.ts`
- `src/lib/auth/errors.ts`
- optional `middleware.ts` later

Do not change these files now.

## 9. Future Route Protection Logic

For each protected layout:

- get current session;
- load profile;
- check profile status;
- check role;
- allow admin/super_admin override where intended;
- redirect safely if denied;
- never expose raw Supabase/auth errors.

## 10. Server Action Rule

Even if route is protected, every real server action must still:

- verify session;
- verify role;
- verify ownership;
- validate action;
- create audit log if needed;
- return safe result.

## 11. Ownership Note

Route protection alone is not enough.

Examples:

- Partner can enter `/partner`, but partner must still not access another partner's order.
- Courier can enter `/courier`, but courier must still not access another courier's delivery.
- Client can enter `/client`, but client must still not access another client's order.

## 12. Testing Checklist For Future Implementation

- Unauthenticated `/client` redirects.
- Unauthenticated `/partner` redirects.
- Unauthenticated `/courier` redirects.
- Unauthenticated `/admin` redirects.
- Client can access `/client`.
- Client cannot access `/partner`, `/courier`, `/admin`.
- Partner can access `/partner`.
- Partner cannot access `/client`, `/courier`, `/admin`.
- Courier can access `/courier`.
- Courier cannot access `/client`, `/partner`, `/admin`.
- Admin can access `/admin` and support internal dashboards.
- `super_admin` can access all protected areas.
- Public pages still work.
- `npm run build` passes.

## 13. Rollback

If protected routes break:

- disable future `AUTH_PROTECTION_ENABLED` if used;
- revert protected layouts;
- keep `DATA_SOURCE_MODE=mock`;
- keep demo pages accessible;
- run `npm run build`;
- restart dev server.

## 14. Security

- No service role key in client components.
- No raw auth errors in UI.
- No real credentials in repo.
- `.env.local` is not committed.
- RLS still required.
- Server-side checks still required.

## 15. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Protected routes must not enable alcohol module.
- Auth roles cannot enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 16. Next Stages

Recommended next stages:

1. `12P-4 Auth Helper Implementation Prompt Draft`
2. `12P-5 Auth + Role Planning Final Audit`
3. `12Q-1 Audit Helper Implementation Plan`
4. `12R-1 First Real Write Pilot Implementation Later`
