-- KÖL: additive public-intake support ticket payload, staging review only.
-- Reconciles the clean migration package with the restored PostgreSQL schema.
-- Anonymous/authenticated callers retain NO direct support_tickets INSERT.
-- Apply only through the reviewed staging sequence and backup/rollback gate.
begin;

alter table public.support_tickets
  add column if not exists request_payload jsonb not null default '{}'::jsonb;

create index if not exists idx_support_tickets_intake_phone_recent
  on public.support_tickets ((request_payload ->> 'contact_phone_hash'), created_at desc);

-- RLS bypass does not imply SQL object privileges on a clean Supabase stack.
-- Only the server-side intake adapter may look up retries and create tickets.
grant usage on schema public to service_role;
grant select, insert on table public.support_tickets to service_role;

commit;
