-- KÖL / kol-travel-platform
-- FOLLOW-UP TO 005 SECURITY HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20 after independent live/diff re-audit.
--
-- Live policy `partners update own business` currently targets role PUBLIC.
-- Ownership/grants already prevent an anonymous update in practice, but the policy
-- contract should explicitly target authenticated callers and avoid evaluating
-- authenticated ownership helpers for irrelevant roles.

begin;

drop policy if exists "partners update own business" on public.partners;

create policy "partners update own business"
on public.partners
for update
to authenticated
using (public.is_partner_for(id))
with check (public.is_partner_for(id));

commit;

-- Required staging checks:
-- - authenticated partner can update only its own partner row;
-- - partner A cannot update partner B;
-- - anon cannot update any partner row;
-- - super_admin behavior remains as explicitly granted by is_partner_for().
