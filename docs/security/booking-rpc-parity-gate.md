# KÖL booking RPC parity release gate

Verified 2026-10-22:
- Local browser smoke currently calls public `create_stay_booking_atomic(...p_idempotency_key...)`.
- Connected remote Supabase currently exposes public `client_stay_booking_create_atomic(uuid,date,date,integer,text)`, not the local RPC name.
- Green local smoke is **not** proof that the connected remote booking API works.

## Read-only parity query (run against both databases)
```sql
select n.nspname as schema_name, p.oid::regprocedure::text as signature,
       p.prosecdef as security_definer,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as auth_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private')
  and p.proname in ('create_stay_booking_atomic',
                   'create_tour_booking_atomic',
                   'client_stay_booking_create_atomic',
                   'client_stay_booking_create_atomic_internal')
order by schema_name,signature;
```

**Blocking gate:** resolve canonical RPC contract in migration files; only then write a clone-based end-to-end test with actual JWTs for that exact contract. Do not deploy a schema migration before role-isolation, replay and overlapping-date tests pass. This document intentionally changes no site code, schema or runtime behavior.
