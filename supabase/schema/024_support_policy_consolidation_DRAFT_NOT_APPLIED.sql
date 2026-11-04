-- KÖL support read-policy consolidation
-- DRAFT — apply only through the reviewed staging migration sequence.
-- Replaces overlapping SELECT policies with one policy per support table.
-- Clients see only their own tickets and public replies. Finance/dispatch admins
-- retain public support visibility; support_admin/super_admin may also read internal
-- notes. Writes remain governed by the audited support RPCs and existing grants.

begin;

drop policy if exists "support admins read all support tickets" on public.support_tickets;
drop policy if exists "users read own support tickets" on public.support_tickets;
drop policy if exists "support ticket owners and admins read tickets" on public.support_tickets;

create policy "support ticket owners and admins read tickets"
on public.support_tickets
for select
to authenticated
using (
  created_by = (select auth.uid())
  or public.is_admin()
);

drop policy if exists "support admins read public ticket messages" on public.ticket_messages;
drop policy if exists "ticket messages follow ticket access" on public.ticket_messages;
drop policy if exists "support message visibility follows ticket access" on public.ticket_messages;

create policy "support message visibility follows ticket access"
on public.ticket_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets as st
    where st.id = ticket_messages.ticket_id
      and (
        st.created_by = (select auth.uid())
        or public.is_admin()
      )
      and (
        ticket_messages.visibility = 'public'
        or (
          ticket_messages.visibility = 'internal'
          and (
            public.has_role('support_admin')
            or public.has_role('super_admin')
          )
        )
      )
  )
);

commit;
