-- KÖL AI knowledge hub: additive FK indexes for update audit columns.
-- Follows 20261122071538_kol_ai_admin_knowledge_hub_v1.sql.
-- Do not alter the already-applied knowledge-hub migration or rewrite its ledger.
-- Safe for a newly provisioned database; no role, data, or RLS changes.
begin;

create index if not exists idx_kol_ai_channels_v1_updated_by
  on public.kol_ai_channels_v1 (updated_by);

create index if not exists idx_kol_ai_materials_v1_updated_by
  on public.kol_ai_materials_v1 (updated_by);

commit;
