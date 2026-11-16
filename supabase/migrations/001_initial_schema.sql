-- ============================================================
-- UE5 Studio Hub - Initial Database Schema (PostgreSQL / Supabase)
-- Supabase Dashboard -> SQL Editor icinde tek seferde calistirin.
-- ============================================================

create extension if not exists "pgcrypto";

-- 1. PROFILES (3 kisilik ekip uyeleri)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  role_title text not null default 'Game Developer',
  avatar_color text not null default '#f59e0b',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Yeni kullanici kaydoldugunda otomatik profil olustur
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  default_name text;
begin
  default_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    split_part(new.email, '@', 1),
    'Developer'
  );

  insert into public.profiles (id, email, display_name, role_title)
  values (
    new.id,
    coalesce(new.email, ''),
    default_name,
    coalesce(new.raw_user_meta_data ->> 'role_title', 'UE5 Developer')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. WORKSPACE SETTINGS (Tek satirlik proje ayarlari)
create table if not exists public.workspace_settings (
  id integer primary key default 1 check (id = 1),
  studio_name text not null default 'Indie UE5 Studio',
  project_name text not null default 'Project Phoenix',
  ue_version text not null default 'UE 5.5',
  discord_webhook_url text,
  updated_at timestamptz not null default now()
);

insert into public.workspace_settings (id, studio_name, project_name, ue_version)
values (1, 'Indie UE5 Studio', 'Project Phoenix', 'UE 5.5')
on conflict (id) do nothing;

-- 3. MILESTONES (Oyun surum hedefleri)
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  target_date date,
  status text not null default 'active' check (status in ('planned', 'active', 'completed')),
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4. IDEAS (Fikir panosu & Mini-GDD)
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  content_md text not null default '',
  category text not null default 'mechanic' check (
    category in ('mechanic', 'lore', 'level', 'vfx', 'audio', 'ui', 'system')
  ),
  status text not null default 'raw' check (
    status in ('raw', 'discussing', 'approved', 'shelved')
  ),
  reference_links jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. IDEA VOTES (Ekip oylamasi)
create table if not exists public.idea_votes (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

-- 6. TASKS & BUGS (Kanban gorevleri + playtest bug kayitlari)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description_md text not null default '',
  kind text not null default 'task' check (kind in ('task', 'bug')),
  status text not null default 'todo' check (
    status in ('backlog', 'todo', 'in_progress', 'testing', 'done')
  ),
  priority text not null default 'medium' check (
    priority in ('low', 'medium', 'high', 'critical')
  ),
  ue_tags text[] not null default '{}',
  assignee_id uuid references public.profiles (id) on delete set null,
  reporter_id uuid references public.profiles (id) on delete set null,
  milestone_id uuid references public.milestones (id) on delete set null,
  source_idea_id uuid references public.ideas (id) on delete set null,
  blocked_by_task_id uuid references public.tasks (id) on delete set null,
  bug_severity text check (bug_severity in ('crash', 'gameplay', 'visual', 'audio', 'minor')),
  repro_steps text not null default '',
  build_version text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_status on public.tasks (status);
create index if not exists idx_tasks_assignee on public.tasks (assignee_id);
create index if not exists idx_tasks_milestone on public.tasks (milestone_id);

-- 7. SUBTASKS (Gorev alt adim checklistleri)
create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_subtasks_task on public.subtasks (task_id);

-- 8. COMMENTS (Fikir ve gorev yorumlari)
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('idea', 'task')),
  target_id uuid not null,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_target on public.comments (target_type, target_id);

-- 9. ATTACHMENTS (Ekran goruntusu, GIF, kisa video ekleri)
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('idea', 'task')),
  target_id uuid not null,
  file_name text not null,
  file_path text not null,
  public_url text not null,
  mime_type text not null default 'image/png',
  file_size bigint not null default 0,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_target on public.attachments (target_type, target_id);

-- 10. ASSET LOCKS (UE5 .uasset / .umap cakisma onleyici kilit panosu)
create table if not exists public.asset_locks (
  id uuid primary key default gen_random_uuid(),
  asset_path text not null unique,
  lock_type text not null default 'blueprint' check (
    lock_type in ('level', 'blueprint', 'mesh', 'animation', 'material', 'other')
  ),
  locked_by uuid not null references public.profiles (id) on delete cascade,
  note text not null default '',
  locked_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Sadece giris yapmis (authenticated) ekip uyeleri erisebilir.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.milestones enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.asset_locks enable row level security;

-- Profiles policies
create policy "Team can view all profiles"
  on public.profiles for select to authenticated using (true);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Shared workspace policies (3 kisilik ekip tam isbirligi)
create policy "Team full access workspace_settings"
  on public.workspace_settings for all to authenticated using (true) with check (true);
create policy "Team full access milestones"
  on public.milestones for all to authenticated using (true) with check (true);
create policy "Team full access ideas"
  on public.ideas for all to authenticated using (true) with check (true);
create policy "Team full access idea_votes"
  on public.idea_votes for all to authenticated using (true) with check (true);
create policy "Team full access tasks"
  on public.tasks for all to authenticated using (true) with check (true);
create policy "Team full access subtasks"
  on public.subtasks for all to authenticated using (true) with check (true);
create policy "Team full access comments"
  on public.comments for all to authenticated using (true) with check (true);
create policy "Team full access attachments"
  on public.attachments for all to authenticated using (true) with check (true);
create policy "Team full access asset_locks"
  on public.asset_locks for all to authenticated using (true) with check (true);

-- ============================================================
-- STORAGE BUCKET (UE5 ekran goruntuleri & GIF'ler icin)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('studio-media', 'studio-media', true)
on conflict (id) do nothing;

create policy "Authenticated can upload studio media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'studio-media');

create policy "Anyone can view studio media"
  on storage.objects for select to public
  using (bucket_id = 'studio-media');

create policy "Authenticated can delete studio media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'studio-media');

-- ============================================================
-- REALTIME PUBLICATION (Canli Kanban & Asset Kilit guncellemeleri)
-- ============================================================
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.asset_locks;
alter publication supabase_realtime add table public.ideas;
