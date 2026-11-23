-- KOL financial reporting v1, service-role-only read API; no monetary mutations.
-- p_to is exclusive; dates use the Asia/Bishkek calendar. NOT automatically applied.
CREATE OR REPLACE FUNCTION public.kol_finance_analytics_v1(
 p_from date, p_to date, p_business_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $finance$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > 366 THEN
   RAISE EXCEPTION 'Invalid reporting period' USING ERRCODE = '22023';
 END IF;
 RETURN (
 WITH
 os AS (
   SELECT id,business_id,type,status,total,(created_at AT TIME ZONE 'Asia/Bishkek')::date AS day
   FROM public.orders WHERE created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND (p_business_id IS NULL OR business_id=p_business_id)
 ),
 bs AS (
   SELECT b.id,b.business_id,b.booking_type,b.status,b.total,
     (b.created_at AT TIME ZONE 'Asia/Bishkek')::date AS day,
     COALESCE(CASE WHEN b.booking_type='stay' THEN NULLIF(BTRIM(st.currency),'')
       WHEN b.booking_type='tour' THEN NULLIF(BTRIM(tr.currency),'') END,'UNKNOWN') AS currency
   FROM public.bookings b
   LEFT JOIN public.rooms rm ON b.booking_type='stay' AND rm.id=b.object_id
   LEFT JOIN public.stays st ON st.id=rm.stay_id
   LEFT JOIN public.tours tr ON b.booking_type='tour' AND tr.id=b.object_id
   WHERE b.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND b.created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND (p_business_id IS NULL OR b.business_id=p_business_id)
 ),
 linked_payments AS (
   SELECT p.id,p.order_id,p.booking_id,p.status,p.amount,p.created_at,
    (p.created_at AT TIME ZONE 'Asia/Bishkek')::date AS day,
    COALESCE(o.business_id,b.business_id) AS business_id,
    CASE WHEN o.id IS NOT NULL THEN 'KGS'
      WHEN b.booking_type='stay' THEN COALESCE(NULLIF(BTRIM(st.currency),''),'UNKNOWN')
      WHEN b.booking_type='tour' THEN COALESCE(NULLIF(BTRIM(tr.currency),''),'UNKNOWN')
      ELSE 'UNKNOWN' END AS currency
   FROM public.payments p
   LEFT JOIN public.orders o ON o.id=p.order_id
   LEFT JOIN public.bookings b ON b.id=p.booking_id
   LEFT JOIN public.rooms rm ON b.booking_type='stay' AND rm.id=b.object_id
   LEFT JOIN public.stays st ON st.id=rm.stay_id
   LEFT JOIN public.tours tr ON b.booking_type='tour' AND tr.id=b.object_id
   WHERE (o.id IS NOT NULL) <> (b.id IS NOT NULL)
   AND (p_business_id IS NULL OR COALESCE(o.business_id,b.business_id)=p_business_id)
 ),
 ps AS (SELECT * FROM linked_payments WHERE created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')),
 fr AS (
   SELECT r.id,r.status,r.amount,p.currency FROM public.refunds r
   JOIN linked_payments p ON p.id=r.payment_id
   WHERE r.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND r.created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
 ),
 po AS (
   SELECT id,status FROM public.payouts WHERE created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND (p_business_id IS NULL OR (recipient_type='partner' AND recipient_id=p_business_id))
 ),
 od AS (SELECT day,count(*) AS n FROM os GROUP BY day),
 bd AS (SELECT day,count(*) AS n FROM bs GROUP BY day),
 pd AS (SELECT day,count(*) FILTER (WHERE status='paid') AS n FROM ps GROUP BY day),
 days AS (
   SELECT d::date AS day,COALESCE(od.n,0) AS orders_count,
    COALESCE(bd.n,0) AS bookings_count,COALESCE(pd.n,0) AS paid_payment_records
   FROM generate_series(p_from::timestamp,(p_to-1)::timestamp,interval '1 day') d
   LEFT JOIN od ON od.day=d::date
   LEFT JOIN bd ON bd.day=d::date
   LEFT JOIN pd ON pd.day=d::date
 )
 SELECT jsonb_build_object(
  'schema_version',1,'timezone','Asia/Bishkek',
  'period_from',p_from,'period_to_exclusive',p_to,'business_id',p_business_id,
  'orders',jsonb_build_object(
    'count',(SELECT count(*) FROM os),
    'submitted_value_kgs',COALESCE((SELECT sum(total) FROM os),0),
    'by_status',(SELECT COALESCE(jsonb_object_agg(status,n),'{}'::jsonb)
                 FROM (SELECT status,count(*) AS n FROM os GROUP BY status) v),
    'by_type',(SELECT COALESCE(jsonb_object_agg(type,n),'{}'::jsonb)
               FROM (SELECT type,count(*) AS n FROM os GROUP BY type) v)
  ),
  'bookings',jsonb_build_object(
    'count',(SELECT count(*) FROM bs),
    'submitted_value_by_currency',
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('currency',currency,'amount',amount,'count',n) ORDER BY currency),'[]'::jsonb)
       FROM (SELECT currency,sum(total) AS amount,count(*) AS n FROM bs GROUP BY currency) v),
    'by_status',(SELECT COALESCE(jsonb_object_agg(status,n),'{}'::jsonb)
                 FROM (SELECT status,count(*) AS n FROM bs GROUP BY status) v)
  ),
  'payments',jsonb_build_object(
    'attempts',(SELECT count(*) FROM ps),
    'recorded_paid_count',(SELECT count(*) FROM ps WHERE status='paid'),
    'recorded_paid_by_currency',
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('currency',currency,'amount',amount,'count',n) ORDER BY currency),'[]'::jsonb)
       FROM (SELECT currency,sum(amount) AS amount,count(*) AS n
             FROM ps WHERE status='paid' GROUP BY currency) v),
    'duplicate_paid_subjects',
      (SELECT count(*) FROM (SELECT COALESCE('order:'||order_id::text,'booking:'||booking_id::text) AS subject
         FROM ps WHERE status='paid'
         GROUP BY COALESCE('order:'||order_id::text,'booking:'||booking_id::text)
         HAVING count(*)>1) duplicates)
  ),
  'refunds',jsonb_build_object(
    'records',(SELECT count(*) FROM fr),
    'by_status',(SELECT COALESCE(jsonb_object_agg(status,n),'{}'::jsonb)
                 FROM (SELECT status,count(*) AS n FROM fr GROUP BY status) v)
  ),
  'payouts',jsonb_build_object(
    'records',(SELECT count(*) FROM po),
    'by_status',(SELECT COALESCE(jsonb_object_agg(status,n),'{}'::jsonb)
                 FROM (SELECT status,count(*) AS n FROM po GROUP BY status) v)
  ),
  'commissions',jsonb_build_object(
    'active_terms',(SELECT count(*) FROM public.commissions
                   WHERE is_active AND (p_business_id IS NULL OR business_id=p_business_id)),
    'earned_amount',NULL
  ),
  'daily',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
     'date',day,'orders',orders_count,'bookings',bookings_count,
     'recorded_paid_payments',paid_payment_records) ORDER BY day),'[]'::jsonb) FROM days),
  'unconfirmed',jsonb_build_array(
    'net_platform_revenue','profit','partner_payable','courier_earnings','marketing_conversion')
 )
 );
END;
$finance$;
REVOKE ALL ON FUNCTION public.kol_finance_analytics_v1(date,date,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kol_finance_analytics_v1(date,date,uuid) TO service_role;
