-- KÖL 026 partner inventory publishing — read-only verification.
DO $verify$
DECLARE
 v_public record;
 v_private record;
 v_index record;
BEGIN
 SELECT p.prosecdef AS definer, p.proconfig AS config
 INTO v_public FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='partner_inventory_publish_atomic'
 AND pg_get_function_identity_arguments(p.oid) =
   'p_scope_type text, p_parent_id uuid, p_date date, p_time time without time zone, p_capacity integer, p_price_override numeric, p_request_id text';
 IF NOT FOUND OR v_public.definer OR NOT EXISTS(
   SELECT 1 FROM unnest(coalesce(v_public.config,'{}'::text[])) x WHERE x LIKE 'search_path=%'
 ) THEN RAISE EXCEPTION '026_public_wrapper_invalid'; END IF;
 SELECT p.prosecdef AS definer, p.proconfig AS config
 INTO v_private FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='partner_inventory_publish_atomic_internal';
 IF NOT FOUND OR NOT v_private.definer OR NOT EXISTS(
   SELECT 1 FROM unnest(coalesce(v_private.config,'{}'::text[])) x WHERE x LIKE 'search_path=%'
 ) THEN RAISE EXCEPTION '026_private_function_invalid'; END IF;
 IF has_function_privilege('anon','public.partner_inventory_publish_atomic(text,uuid,date,time,integer,numeric,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.partner_inventory_publish_atomic(text,uuid,date,time,integer,numeric,text)','EXECUTE')
 OR has_function_privilege('anon','private.partner_inventory_publish_atomic_internal(text,uuid,date,time,integer,numeric,text)','EXECUTE')
 THEN RAISE EXCEPTION '026_inventory_rpc_acl_invalid'; END IF;
 IF has_table_privilege('authenticated','public.room_availability','INSERT')
 OR has_table_privilege('authenticated','public.tour_schedules','INSERT')
 THEN RAISE EXCEPTION '026_direct_inventory_insert_must_remain_denied'; END IF;
 SELECT i.indisunique AS is_unique,i.indisvalid AS is_valid,i.indnullsnotdistinct AS nulls_not_distinct
 INTO v_index FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='uq_kol_tour_schedule_exact_slot';
 IF NOT FOUND OR NOT v_index.is_unique OR NOT v_index.is_valid OR NOT v_index.nulls_not_distinct
 THEN RAISE EXCEPTION '026_tour_unique_index_invalid'; END IF;
END
$verify$;
SELECT '026_PARTNER_INVENTORY_VERIFY_PASS' AS result;
