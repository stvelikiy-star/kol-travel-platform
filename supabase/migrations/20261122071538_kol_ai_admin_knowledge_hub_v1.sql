-- KÖL AI administration foundations, 22 Nov 2026.
-- Knowledge and response scripts only. Does not invoke AI, create chats,
-- send messages, or enable WhatsApp/Telegram.
-- Apply to KÖL TEST after existing catalog/admin migrations; PRODUCTION separately.
begin;

create table if not exists public.kol_ai_materials_v1 (
  id uuid primary key default gen_random_uuid(),
  material_key text not null check (material_key ~ '^[a-z][a-z0-9_.-]{2,79}$'),
  locale text not null check (locale in ('ru','ky','en')),
  kind text not null check (kind in ('faq','script','guide','policy','handoff')),
  audience text not null check (audience in ('public','client','partner','staff','admin')),
  title text not null check (char_length(trim(title)) between 3 and 150),
  body text not null check (char_length(trim(body)) between 1 and 8000),
  source_url text check (source_url is null or (char_length(source_url)<=600 and source_url ~ '^https://[^[:space:]]+$')),
  priority integer not null default 100 check (priority between 0 and 999),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  version integer not null default 1 check (version >= 1),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (material_key,locale)
);

create index if not exists kol_ai_materials_lookup_v1
on public.kol_ai_materials_v1 (status,audience,locale,kind,priority);

create table if not exists public.kol_ai_material_versions_v1 (
  id bigint generated always as identity primary key,
  material_id uuid not null references public.kol_ai_materials_v1(id) on delete cascade,
  version integer not null,
  material_key text not null,
  locale text not null,
  kind text not null,
  audience text not null,
  title text not null,
  body text not null,
  source_url text,
  priority integer not null,
  status text not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  unique (material_id,version)
);

create table if not exists public.kol_ai_channels_v1 (
  channel text primary key check (channel in ('web','whatsapp','telegram')),
  provider text not null,
  route_hint text not null default '/contacts'
     check (route_hint ~ '^/[a-z0-9/_-]*$' and char_length(route_hint) < 140),
  admin_note text not null default '' check (char_length(admin_note)<=1000),
  enabled boolean not null default false check (enabled = false),
  auto_reply boolean not null default false check (auto_reply = false),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Provider connections and replies deliberately cannot be activated by a
-- database settings change; activation requires a separately reviewed release.
insert into public.kol_ai_channels_v1 (channel,provider,route_hint,admin_note)
values
  ('web','KÖL website','/contacts','AI disabled. Existing navigation helper remains available.'),
  ('whatsapp','GREEN-API / official WhatsApp review pending','/contacts','Webhook URL, tokens and telephone numbers are not configured.'),
  ('telegram','Telegram Bot API','/contacts','Bot token and webhook are not configured.')
on conflict (channel) do nothing;

-- Reuse the EXISTING KÖL active-account and role check. No anon read.
alter table public.kol_ai_materials_v1 enable row level security;
alter table public.kol_ai_material_versions_v1 enable row level security;
alter table public.kol_ai_channels_v1 enable row level security;

create policy kol_ai_materials_editor_read_v1
on public.kol_ai_materials_v1 for select to authenticated
using ((select private.can_manage_content()));

create policy kol_ai_materials_editor_insert_v1
on public.kol_ai_materials_v1 for insert to authenticated
with check ((select private.can_manage_content()));

create policy kol_ai_materials_editor_update_v1
on public.kol_ai_materials_v1 for update to authenticated
using ((select private.can_manage_content()))
with check ((select private.can_manage_content()));

create policy kol_ai_material_versions_editor_read_v1
on public.kol_ai_material_versions_v1 for select to authenticated
using ((select private.can_manage_content()));

create policy kol_ai_channels_editor_read_v1
on public.kol_ai_channels_v1 for select to authenticated
using ((select private.can_manage_content()));

create policy kol_ai_channels_editor_update_v1
on public.kol_ai_channels_v1 for update to authenticated
using ((select private.can_manage_content()))
with check ((select private.can_manage_content()) and enabled = false and auto_reply = false);

-- Opt in explicitly to the Data API under the 2026 grant defaults.
-- In older projects, remove implicit broad grants first (including DELETE).
revoke all on public.kol_ai_materials_v1 from anon,authenticated;
revoke all on public.kol_ai_material_versions_v1 from anon,authenticated;
revoke all on public.kol_ai_channels_v1 from anon,authenticated;

grant select,insert,update on public.kol_ai_materials_v1 to authenticated;
grant select on public.kol_ai_material_versions_v1 to authenticated;
grant select,update (route_hint,admin_note,updated_by,updated_at)
  on public.kol_ai_channels_v1 to authenticated;
revoke all on public.kol_ai_materials_v1 from anon;
revoke all on public.kol_ai_material_versions_v1 from anon;
revoke all on public.kol_ai_channels_v1 from anon;

-- Version is server-owned; a history row is recorded for every saved change.
create or replace function private.kol_ai_material_before_write_v1()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    new.version := 1;
    new.created_at := now();
  else
    new.version := old.version + 1;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.status='published' then
    if tg_op='INSERT' or old.status is distinct from 'published' then
      new.published_at := now();
    end if;
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;

create or replace function private.kol_ai_material_snapshot_v1()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.kol_ai_material_versions_v1
    (material_id,version,material_key,locale,kind,audience,title,body,
     source_url,priority,status,changed_by)
  values
    (new.id,new.version,new.material_key,new.locale,new.kind,new.audience,
     new.title,new.body,new.source_url,new.priority,new.status,auth.uid());
  return new;
end;
$$;

revoke all on function private.kol_ai_material_before_write_v1() from public,anon,authenticated;
revoke all on function private.kol_ai_material_snapshot_v1() from public,anon,authenticated;

create trigger kol_ai_material_before_write_v1
before insert or update on public.kol_ai_materials_v1
for each row execute function private.kol_ai_material_before_write_v1();

create trigger kol_ai_material_snapshot_v1
after insert or update on public.kol_ai_materials_v1
for each row execute function private.kol_ai_material_snapshot_v1();

comment on table public.kol_ai_materials_v1 is
  'Editor-owned KB drafts and approved scripts. NOT an AI endpoint; no public Data API access.';
comment on table public.kol_ai_channels_v1 is
  'Integration configuration placeholder. enabled and auto_reply are hard-disabled until separate release. Never store API tokens here.';
commit;
