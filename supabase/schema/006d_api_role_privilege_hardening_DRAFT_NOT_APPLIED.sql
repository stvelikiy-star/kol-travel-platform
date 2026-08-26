-- KÖL / kol-travel-platform
-- DATA API ROLE PRIVILEGE HARDENING — DRAFT / NOT APPLIED
-- Prepared: 2026-08-21
--
-- Purpose:
--   Make the public Data API table-privilege contract deterministic before the
--   transactional layers are rehearsed. RLS does not protect TRUNCATE, so this
--   layer explicitly removes unsafe table privileges that may be inherited from
--   recovery/local defaults.
--
-- Safety:
--   - no data mutation;
--   - no table/schema deletion;
--   - anon keeps SELECT only on the explicitly public catalog allowlist;
--   - authenticated keeps ordinary SELECT/INSERT/UPDATE/DELETE grants and loses
--     only TRUNCATE/REFERENCES/TRIGGER, which application sessions do not need.
--
-- NOT APPLIED to live Supabase.

begin;

-- Anonymous browser sessions have no business reason to mutate public tables or
-- use sequence/DDL-adjacent table privileges. Start from zero table/sequence ACL
-- and grant back only the explicit public read surface.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

grant select on table
  public.partners,
  public.categories,
  public.tours,
  public.stays,
  public.menu_items,
  public.products,
  public.restaurants,
  public.shops
to anon;

-- Authenticated application sessions may need row-level DML according to RLS,
-- but they must never receive privileges that bypass or redefine row security.
revoke truncate, references, trigger on all tables in schema public from authenticated;

commit;
