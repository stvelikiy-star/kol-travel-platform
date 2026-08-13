# Supabase Schema Run Order

Run SQL manually in the Supabase TEST project only.

1. Run `001_initial_schema.sql`.
2. Run `002_rls_policies_draft.sql`.
3. Run `003_seed_demo_data_draft.sql`.

If any file fails, stop and fix the issue before running the next file.

Keep `DATA_SOURCE_MODE=mock` and `ALCOHOL_MODULE_ENABLED=false`.

## Fixed Seed Fallback

If `003_seed_demo_data_draft.sql` fails with a `user_profiles_user_id_fkey` error, use:

- `003_seed_demo_data_draft_FIXED.sql`

If partial seed data was inserted, the safest test-project path is:

1. Reset the public schema in the Supabase TEST project.
2. Re-run `001_initial_schema.sql`.
3. Re-run `002_rls_policies_draft.sql`.
4. Run `003_seed_demo_data_draft_FIXED.sql`.
