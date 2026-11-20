-- KÖL: courier delivery-issue RLS hardening and scoped reads.
-- The existing courier INSERT policy allowed created_by to be forged on the courier's own delivery.
-- Admins retain their pre-existing ability to open incidents on behalf of others.
ALTER POLICY "couriers create delivery issues"
  ON public.delivery_issues
  WITH CHECK (
    public.is_admin()
    OR (
      created_by = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.deliveries d
        WHERE d.id = delivery_issues.delivery_id
          AND public.is_assigned_courier(d.id)
      )
    )
  );

CREATE POLICY "courier owner or admin reads delivery issues"
  ON public.delivery_issues
  FOR SELECT
  TO authenticated
  USING (
    (created_by = (SELECT auth.uid()) AND public.has_role('courier'))
    OR public.is_admin()
  );
