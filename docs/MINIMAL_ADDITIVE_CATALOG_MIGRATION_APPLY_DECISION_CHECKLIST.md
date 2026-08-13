# Stage 21-4 - Minimal Additive Catalog Migration Apply Decision Checklist

## Status

This checklist is for future decision-making only.

Do not apply SQL in this stage.

## Pre-Apply Decision

SQL can be considered only if all are true:

- `[ ]` This is the Supabase TEST project, not production.
- `[ ]` Backup/export is done.
- `[ ]` `DATA_SOURCE_MODE=mock`.
- `[ ]` `npm run build` passes before apply.
- `[ ]` `/food` mock mode works.
- `[ ]` `/food` Supabase mode works before apply.
- `[ ]` `alcohol_module_settings.is_enabled=false`.
- `[ ]` User explicitly approves applying SQL.

## Manual SQL Pre-Checks

Before any future apply, run:

- `[ ]` table existence check
- `[ ]` column check for target tables
- `[ ]` row counts
- `[ ]` `/food` adapter sample check
- `[ ]` alcohol check

Target draft:

- `supabase/schema/004_minimal_additive_catalog_fields_DRAFT_NOT_APPLIED.sql`

## SQL Review

Confirm:

- `[ ]` additive-only
- `[ ]` no destructive table operations
- `[ ]` no destructive data operations
- `[ ]` no forced required columns
- `[ ]` no unique constraints
- `[ ]` no RLS changes
- `[ ]` no seed data
- `[ ]` no alcohol changes

## Apply Scope

If approved later, apply only:

- `supabase/schema/004_minimal_additive_catalog_fields_DRAFT_NOT_APPLIED.sql`

But only after copying or renaming it to an approved migration name in a future stage.

Do not apply the draft directly to production.

## Post-Apply Checks

After future test apply:

- `[ ]` verify new columns exist
- `[ ]` verify row counts unchanged
- `[ ]` verify `/food` Supabase read works
- `[ ]` verify `/food` mock fallback works
- `[ ]` verify alcohol remains disabled
- `[ ]` verify no audit insert from reads
- `[ ]` run `npm run build`

## Rollback Posture

Because the draft is additive:

- do not immediately remove columns if something fails
- set `DATA_SOURCE_MODE=mock`
- use mock fallback
- investigate safely
- only use manual rollback in test environment after approval

## Do-Not-Apply Conditions

Do not apply if:

- any uncertainty about Supabase project
- no backup
- `/food` adapter is currently broken
- alcohol check fails
- SQL contains unsafe statements
- build fails
- user has not explicitly approved apply

## Alcohol

- `ALCOHOL_MODULE_ENABLED=false`
- `alcohol_module_settings` remains untouched
- no alcohol categories/items
- no alcohol sales/delivery
- no alcohol activation path

## Final Decision Options

Choose one later:

- `[ ]` APPROVED FOR FUTURE TEST APPLY
- `[ ]` NOT APPROVED
- `[ ]` NEEDS REVISION
- `[ ]` WAITING FOR MANUAL BACKUP

Do not mark approved automatically.
