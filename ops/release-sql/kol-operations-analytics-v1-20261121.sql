-- KÖL 051: service-only, tenant-scoped operational aggregates. No invented traffic or money.
CREATE OR REPLACE FUNCTION public.kol_operations_analytics_v1(
 p_from date,p_to date,p_business_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $report$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>366 THEN
  RAISE EXCEPTION 'invalid_analytics_period' USING ERRCODE='22023';
 END IF;
 RETURN (
 WITH os AS (
   SELECT o.client_id,o.business_id,o.status,o.type,o.total,
     (o.created_at AT TIME ZONE 'Asia/Bishkek')::date AS local_date,
     extract(hour FROM o.created_at AT TIME ZONE 'Asia/Bishkek')::integer AS local_hour
   FROM public.orders o
   WHERE o.created_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND o.created_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND (p_business_id IS NULL OR o.business_id=p_business_id)
 ),
 bs AS (
   SELECT b.client_id,b.business_id,b.status,b.booking_type,
     (b.created_at AT TIME ZONE 'Asia/Bishkek')::date AS local_date,
     extract(hour FROM b.created_at AT TIME ZONE 'Asia/Bishkek')::integer AS local_hour
   FROM public.bookings b
   WHERE b.created_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND b.created_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND (p_business_id IS NULL OR b.business_id=p_business_id)
 ),
 activity AS (
   SELECT os.client_id,os.local_date,os.local_hour,'order'::text AS source FROM os
   UNION ALL SELECT bs.client_id,bs.local_date,bs.local_hour,'booking'::text FROM bs
 ),
 client_counts AS (
   SELECT client_id,count(*) AS n FROM activity GROUP BY client_id
 ),
 deliveries_scope AS (
   SELECT d.status,d.risk_level
   FROM public.deliveries d JOIN public.orders o ON o.id=d.order_id
   WHERE d.created_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND d.created_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND (p_business_id IS NULL OR o.business_id=p_business_id)
 ),
 supports AS (
   SELECT t.id,t.status FROM public.support_tickets t
   LEFT JOIN public.orders oo ON oo.id=t.related_order_id
   LEFT JOIN public.bookings bb ON bb.id=t.related_booking_id
   WHERE t.created_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND t.created_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND (p_business_id IS NULL OR oo.business_id=p_business_id OR bb.business_id=p_business_id)
 )
 SELECT jsonb_build_object(
   'schema_version',1,'kind','operational_not_financial',
   'business_id',p_business_id,'period_from',p_from,'period_to_exclusive',p_to,
   'timezone','Asia/Bishkek',
   'orders',jsonb_build_object(
      'count',(SELECT count(*) FROM os),
      'completed',(SELECT count(*) FROM os WHERE status='completed'),
      'cancelled',(SELECT count(*) FROM os WHERE status IN ('cancelled','rejected')),
      'submitted_value_kgs',(SELECT coalesce(sum(total),0) FROM os),
      'by_status',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb)
       FROM (SELECT status,count(*) AS n FROM os GROUP BY status) x),
      'by_service',(SELECT coalesce(jsonb_object_agg(type,n),'{}'::jsonb)
       FROM (SELECT type,count(*) AS n FROM os GROUP BY type) x)
   ),
   'bookings',jsonb_build_object(
      'count',(SELECT count(*) FROM bs),
      'completed',(SELECT count(*) FROM bs WHERE status='completed'),
      'cancelled',(SELECT count(*) FROM bs WHERE status IN ('cancelled','rejected','no_show')),
      'by_status',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb)
       FROM (SELECT status,count(*) AS n FROM bs GROUP BY status) x),
      'by_service',(SELECT coalesce(jsonb_object_agg(booking_type,n),'{}'::jsonb)
       FROM (SELECT booking_type,count(*) AS n FROM bs GROUP BY booking_type) x)
   ),
   'clients',jsonb_build_object(
      'unique_in_period',(SELECT count(*) FROM client_counts),
      'repeat_in_period',(SELECT count(*) FROM client_counts WHERE n>=2),
      'repeat_percentage_in_period',(SELECT
         round((count(*) FILTER(WHERE n>=2))::numeric*100/NULLIF(count(*),0),2)
         FROM client_counts)
   ),
   'deliveries',jsonb_build_object(
      'count',(SELECT count(*) FROM deliveries_scope),
      'high_risk',(SELECT count(*) FROM deliveries_scope WHERE risk_level IN ('high','critical')),
      'by_status',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb)
       FROM (SELECT status,count(*) AS n FROM deliveries_scope GROUP BY status) x),
      'sla_minutes',NULL
   ),
   'support',jsonb_build_object(
      'count',(SELECT count(*) FROM supports),
      'by_status',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb)
       FROM (SELECT status,count(*) AS n FROM supports GROUP BY status) x)
   ),
   'daily',(SELECT coalesce(jsonb_agg(jsonb_build_object(
       'date',dt.local_date,
       'orders',(SELECT count(*) FROM os WHERE local_date=dt.local_date),
       'bookings',(SELECT count(*) FROM bs WHERE local_date=dt.local_date),
       'completed_orders',(SELECT count(*) FROM os WHERE local_date=dt.local_date AND status='completed'),
       'completed_bookings',(SELECT count(*) FROM bs WHERE local_date=dt.local_date AND status='completed')
     ) ORDER BY dt.local_date),'[]'::jsonb)
     FROM (SELECT generate_series(p_from::timestamp,(p_to-1)::timestamp,interval '1 day')::date AS local_date) dt),
   'hourly_created_operations',(SELECT coalesce(jsonb_agg(jsonb_build_object(
       'hour',h.hh,'count',(SELECT count(*) FROM activity WHERE local_hour=h.hh)
     ) ORDER BY h.hh),'[]'::jsonb)
     FROM generate_series(0,23) AS h(hh)),
   'traffic_visits',NULL,'conversion_rate',NULL,'marketing_attribution',NULL,
   'paid_revenue',NULL,'profit',NULL,
   'warning','Real recorded operations only. Repeat customers are within this period; no traffic conversion, attribution or revenue inferred.'
 )
 );
END;
$report$;
REVOKE ALL ON FUNCTION public.kol_operations_analytics_v1(date,date,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_operations_analytics_v1(date,date,uuid) TO service_role;
