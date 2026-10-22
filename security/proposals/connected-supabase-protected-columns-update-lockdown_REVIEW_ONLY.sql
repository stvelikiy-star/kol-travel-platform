-- KÖL: connected schema protected ownership links. REVIEW ONLY.
-- No execution against the connected database until isolated-clone API tests
-- prove partner/courier/admin workflows remain intact.
--
-- Current live finding (2026-10-22): authenticated has table-wide UPDATE on
-- bookings, orders and deliveries, exposing ownership/key link columns to UPDATE.
-- RLS scopes which rows are reachable, not which columns a granted user can edit.
--
-- This candidate removes authenticated table-wide UPDATE, then grants only
-- partner/courier workflow status columns. If workflows need additional
-- columns, change and test this allowlist in an isolated clone before apply.
BEGIN;

REVOKE UPDATE ON public.bookings, public.orders, public.deliveries FROM authenticated;
GRANT UPDATE (status) ON public.bookings TO authenticated;
GRANT UPDATE (status) ON public.orders TO authenticated;
GRANT UPDATE (status) ON public.deliveries TO authenticated;

DO $verify$
DECLARE
  v_table text;
  v_col text;
BEGIN
  -- Explicit, inherited and PUBLIC table-level UPDATE grants are unsafe.
  FOREACH v_table IN ARRAY ARRAY['bookings','orders','deliveries'] LOOP
    -- has_table_privilege(...,'UPDATE') can be TRUE because of a
    -- column-level UPDATE grant (status), so it is not a table-wide
    -- permission test. Inspect the actual table-level grants instead.
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_table
        AND EXISTS (
          SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
          WHERE a.privilege_type = 'UPDATE'
            AND (a.grantee = 0 OR a.grantee = 'authenticated'::regrole OR EXISTS (
              SELECT 1 FROM pg_roles inherited
              WHERE inherited.oid = a.grantee
                AND pg_has_role('authenticated', inherited.oid, 'MEMBER')
            ))
        )
    ) THEN
      RAISE EXCEPTION 'Unsafe table-wide UPDATE remains on %', v_table;
    END IF;
  END LOOP;
  FOR v_table,v_col IN SELECT * FROM (VALUES
    ('bookings','client_id'),('bookings','business_id'),
    ('orders','client_id'),('orders','business_id'),
    ('deliveries','order_id')) AS t(table_name,col_name)
  LOOP
    IF has_column_privilege('authenticated','public.' || v_table,v_col,'UPDATE') THEN
      RAISE EXCEPTION 'Unsafe protected link UPDATE remains on %.%', v_table,v_col;
    END IF;
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY['bookings','orders','deliveries'] LOOP
    IF NOT has_column_privilege('authenticated','public.' || v_table,'status','UPDATE') THEN
      RAISE EXCEPTION 'Status update ACL missing on %',v_table;
    END IF;
  END LOOP;
END
$verify$;

COMMIT;

-- This proposal may be too restrictive for existing partner/courier workflows.
-- Before live use, exercise ALL affected API updates on an isolated schema
-- cloned from the connected database, then approve the final column allowlist.
