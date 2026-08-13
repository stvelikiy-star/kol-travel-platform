# Stage 12U-2 - Supabase Seed FK Fix Notes

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## What Failed

Running `supabase/schema/003_seed_demo_data_draft.sql` failed after SQL 001 and 002 were applied:

```text
ERROR: 23503:
insert or update on table "user_profiles" violates foreign key constraint "user_profiles_user_id_fkey"
DETAIL:
Key (user_id)=(00000000-0000-0000-0000-000000000001) is not present in table "users".
```

## Why It Failed

`001_initial_schema.sql` defines several tables with foreign keys to `auth.users(id)`, including:

- `public.user_profiles.user_id`
- `public.user_roles.user_id`
- `public.client_profiles.user_id`
- `public.partners.owner_user_id`
- `public.courier_profiles.user_id`
- `public.admin_profiles.user_id`
- `public.orders.client_id`
- `public.bookings.client_id`
- `public.deliveries.assigned_courier_id`

The original `003_seed_demo_data_draft.sql` inserted rows into `public.user_profiles` before the referenced demo user ids existed in `auth.users`.

## What Changed

Created corrected copy:

- `supabase/schema/003_seed_demo_data_draft_FIXED.sql`

The original `003_seed_demo_data_draft.sql` was not changed.

The fixed seed:

- inserts FK parent demo rows into `auth.users` before `public.user_profiles`;
- keeps the same fixed demo UUIDs used by public seed rows;
- uses `on conflict (id) do nothing` for demo auth users;
- makes `public.user_roles` safer for repeated test runs using `is not distinct from` for nullable `scope_id`;
- makes `public.order_items` insert safer with `where not exists`;
- makes `public.ai_recommendations` insert safer with `where not exists`;
- keeps alcohol module disabled through `public.alcohol_module_settings`.

## Important Auth Note

The `auth.users` rows in the fixed seed are FK/demo seed rows only. They are not intended as real login credentials.

For real login testing, create test users manually in Supabase Authentication and map profiles after checking the actual profile table fields.

## Can You Run The Fixed Seed Directly?

If the original 003 failed immediately on `user_profiles`, it likely inserted no child seed rows. In that case, the fixed seed may be run directly in the test project.

If the original 003 partially inserted data before failing, do not repeatedly run seeds blindly. The safest test-project path is:

1. Reset the public schema in the Supabase TEST project.
2. Run `supabase/schema/001_initial_schema.sql`.
3. Run `supabase/schema/002_rls_policies_draft.sql`.
4. Run `supabase/schema/003_seed_demo_data_draft_FIXED.sql`.

## Manual Next Steps

1. Confirm you are in the Supabase TEST project, not production.
2. If there may be partial seed data, reset public schema in the test project.
3. Run SQL 001.
4. Run SQL 002.
5. Run `003_seed_demo_data_draft_FIXED.sql`.
6. Verify demo rows in `auth.users`, `public.user_profiles`, `public.partners`, `public.orders`, `public.bookings`, and `public.deliveries`.

## Safety

- Do not run this against production.
- Do not paste service role keys into SQL files.
- Keep `DATA_SOURCE_MODE=mock`.
- Keep `ALCOHOL_MODULE_ENABLED=false`.
- No app real writes were added.
- No route protection was added.
