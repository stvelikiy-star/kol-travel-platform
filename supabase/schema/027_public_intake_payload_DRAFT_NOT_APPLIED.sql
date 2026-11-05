-- KÖL: additive public-intake support ticket payload, staging review only.
-- Reconciles the clean migration package with the restored PostgreSQL schema.
-- Anonymous/authenticated callers retain NO direct support_tickets INSERT.
-- Apply only through the reviewed staging sequence and backup/rollback gate.
begin;

alter table public.support_tickets
  add column if not exists request_payload jsonb not null default '{}'::jsonb;

create index if not exists idx_support_tickets_intake_phone_recent
  on public.support_tickets ((request_payload ->> 'contact_phone_hash'), created_at desc);

commit;
