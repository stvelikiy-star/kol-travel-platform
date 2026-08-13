# Protected Route Strategy Checklist

Stage: 12M-2 - Protected Route Strategy Checklist.

This checklist plans future protected route implementation. Do not implement protected routes yet, do not connect Supabase Auth, do not create middleware, and do not change UI behavior in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan future protected route implementation.
- Keep demo mode stable for now.
- Avoid locking user out during development.
- Protect internal cabinets later.
- Keep route protection separate from server action authorization.

## 2. Current State

- All routes are accessible in demo mode.
- No real auth enforcement yet.
- No middleware enforcement yet.
- No real Supabase session required yet.
- Demo actions and mock data remain active.

## 3. Public Routes

Remain public:

- `/`
- `/tours`
- `/stays`
- `/food`
- `/shop`
- `/partners`
- `/contacts`
- detail catalog pages
- success pages may be public/demo for now

Public routes should not require Supabase Auth and should not expose private user or operations data.

## 4. Client Protected Routes Later

Routes:

- `/client/**`

Allowed:

- `client`
- `admin`
- `super_admin`

Rules:

- Client sees own data only.
- Admin/super_admin can support/review later.
- Unauthenticated users redirect to login later.

## 5. Partner Protected Routes Later

Routes:

- `/partner/**`

Allowed:

- `partner`
- `admin`
- `super_admin`

Rules:

- Partner sees own business only.
- Admin/super_admin can review/support later.
- Partner ownership checks still required inside server actions.
- Route access alone is not enough.

## 6. Courier Protected Routes Later

Routes:

- `/courier/**`

Allowed:

- `courier`
- `admin`
- `super_admin`

Rules:

- Courier sees own deliveries/profile only.
- Admin/super_admin can review/support later.
- Delivery assignment checks still required inside server actions.

## 7. Admin Protected Routes Later

Routes:

- `/admin/**`

Allowed:

- `admin`
- `super_admin`

Rules:

- Admin can access operations.
- High-risk settings require `super_admin` later.
- Finance/legal/compliance screens need stricter permission later.

## 8. Super Admin Only Routes/Settings Later

Future super admin areas:

- platform settings;
- role management;
- compliance activation;
- alcohol-related compliance flow if ever legally approved.

Rules:

- `super_admin` still cannot bypass legal/licensing requirements.
- Alcohol module remains disabled by default.

## 9. AI Dispatcher Access

- No browser login as `ai_dispatcher_system`.
- AI dispatcher writes must be server-only.
- AI cannot access client-facing protected routes as a user.
- AI cannot bypass auth/RLS/approval rules.
- AI cannot execute high-risk actions from route access.

## 10. Implementation Options Later

Options:

- `middleware.ts` route protection.
- Layout-level server checks.
- Page-level server checks.
- Server action checks.

Recommendation:

- Use middleware/layout for broad route protection.
- Always use server action checks for real mutations.
- Always use ownership checks for partner/courier/client data.
- Keep route protection and data access authorization layered rather than relying on one mechanism.

## 11. Redirect Behavior Later

- Unauthenticated -> `/login`.
- Wrong role -> `/not-authorized` or dashboard home.
- Blocked/suspended user -> support/admin review page.
- Missing profile -> onboarding/profile completion.

Redirects should use safe messages and should not leak role or RLS details.

## 12. Development Safety

- Keep demo mode available until auth is stable.
- Do not enforce protection before test users exist.
- Add feature flag if needed.
- Keep rollback path.
- Do not delete mock data.
- Do not remove demo actions.

## 13. Security Checklist

- Never trust client-only role.
- Do server-side session check.
- Verify role from profile table.
- Verify ownership per action/query.
- Keep service role key server-only.
- No private env in client components.
- No raw auth errors in UI.
- Keep RLS as a second layer of protection.

## 14. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Protected routes must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 15. Next Stages

Recommended next stages:

1. `12M-3 Role Helper Pseudocode`
2. `12M-4 Auth Test User Plan`
3. `12N-1 Audit Log Implementation Plan`
4. `12O-1 First Real Write Implementation Preparation`
