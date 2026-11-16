-- ============================================================
-- UE5 Studio Hub - Google Drive Asset Bildirimleri (002)
-- Supabase Dashboard -> SQL Editor icinde calistirin.
-- ============================================================

create table if not exists public.drive_events (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null,
  file_name text not null,
  mime_type text not null default '',
  file_size bigint not null default 0,
  folder_name text not null default 'Ana Klasor',
  web_view_link text not null default 'https://drive.google.com',
  uploaded_by_name text not null default 'Ekip Uyesi',
  event_type text not null default 'created' check (event_type in ('created', 'updated')),
  created_at timestamptz not null default now()
);

create index if not exists idx_drive_events_created_at
  on public.drive_events (created_at desc);

alter table public.drive_events enable row level security;

drop policy if exists "Team full access drive_events" on public.drive_events;
create policy "Team full access drive_events"
  on public.drive_events for all to authenticated using (true) with check (true);

-- Dis Google Apps Script webhook'undan anon anahtari ile guvenli kayit eklemek icin RPC
create or replace function public.record_drive_event(
  p_drive_file_id text,
  p_file_name text,
  p_mime_type text default '',
  p_file_size bigint default 0,
  p_folder_name text default 'Ana Klasor',
  p_web_view_link text default 'https://drive.google.com',
  p_uploaded_by_name text default 'Ekip Uyesi',
  p_event_type text default 'created'
)
returns table (
  id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_created_at timestamptz;
  v_event_type text;
begin
  v_event_type := case when p_event_type = 'updated' then 'updated' else 'created' end;

  insert into public.drive_events (
    drive_file_id,
    file_name,
    mime_type,
    file_size,
    folder_name,
    web_view_link,
    uploaded_by_name,
    event_type
  )
  values (
    coalesce(nullif(trim(p_drive_file_id), ''), gen_random_uuid()::text),
    coalesce(nullif(trim(p_file_name), ''), 'Bilinmeyen Asset'),
    coalesce(p_mime_type, ''),
    greatest(coalesce(p_file_size, 0), 0),
    coalesce(nullif(trim(p_folder_name), ''), 'Ana Klasor'),
    coalesce(nullif(trim(p_web_view_link), ''), 'https://drive.google.com'),
    coalesce(nullif(trim(p_uploaded_by_name), ''), 'Ekip Uyesi'),
    v_event_type
  )
  returning drive_events.id, drive_events.created_at
  into v_id, v_created_at;

  -- Yalnizca en guncel 100 Drive kaydini sakla
  delete from public.drive_events
  where drive_events.id in (
    select de.id
    from public.drive_events de
    order by de.created_at desc
    offset 100
  );

  return query select v_id, v_created_at;
end;
$$;

grant execute on function public.record_drive_event(
  text, text, text, bigint, text, text, text, text
) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.drive_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
