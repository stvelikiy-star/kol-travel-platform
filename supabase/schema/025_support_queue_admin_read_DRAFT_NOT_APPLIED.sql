-- KÖL / SUPPORT QUEUE READ SCOPE — DRAFT / NOT APPLIED
-- Allows only active support_admin/super_admin sessions to read the support queue.
-- Client ownership reads remain unchanged; direct support writes stay RPC-only.

begin;

drop policy if exists "support admins read all support tickets" on public.support_tickets;
create policy "support admins read all support tickets"
  on public.support_tickets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.is_active = true
        and ur.role in ('support_admin', 'super_admin')
    )
  );

drop policy if exists "support admins read public ticket messages" on public.ticket_messages;
create policy "support admins read public ticket messages"
  on public.ticket_messages
  for select
  to authenticated
  using (
    visibility = 'public'
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.is_active = true
        and ur.role in ('support_admin', 'super_admin')
    )
  );

commit;
