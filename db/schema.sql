create extension if not exists "pgcrypto";

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique,
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  is_public boolean not null default false,
  theme jsonb not null default '{}'::jsonb,
  data_model jsonb not null default '{"relationships":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.reports(project_id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.reports(project_id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  source_type text not null check (source_type in ('csv', 'xlsx', 'google_sheets', 'manual', 'unknown')),
  source_url text,
  columns jsonb not null default '[]'::jsonb,
  column_config jsonb not null default '[]'::jsonb,
  calculated_fields jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.widgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.reports(project_id) on delete cascade,
  page_id uuid not null references public.report_pages(id) on delete cascade,
  type text not null,
  layout jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports add column if not exists data_model jsonb not null default '{"relationships":[]}'::jsonb;
alter table public.datasets add column if not exists column_config jsonb not null default '[]'::jsonb;
alter table public.datasets add column if not exists calculated_fields jsonb not null default '[]'::jsonb;
alter table public.datasets drop constraint if exists datasets_source_type_check;
alter table public.datasets add constraint datasets_source_type_check check (source_type in ('csv', 'xlsx', 'google_sheets', 'manual', 'unknown'));

create index if not exists reports_owner_idx on public.reports(owner_id);
create index if not exists report_pages_project_idx on public.report_pages(project_id);
create index if not exists datasets_project_idx on public.datasets(project_id);
create index if not exists widgets_project_idx on public.widgets(project_id);
create index if not exists widgets_page_idx on public.widgets(page_id);

alter table public.reports enable row level security;
alter table public.report_pages enable row level security;
alter table public.datasets enable row level security;
alter table public.widgets enable row level security;

create policy "read own or public reports" on public.reports for select using (
  owner_id = auth.uid() or owner_id is null or is_public = true
);

create policy "write own or anonymous reports" on public.reports for all using (
  owner_id = auth.uid() or owner_id is null
) with check (
  owner_id = auth.uid() or owner_id is null
);

create policy "read own or public pages" on public.report_pages for select using (
  exists (
    select 1 from public.reports r
    where r.project_id = report_pages.project_id
      and (r.owner_id = auth.uid() or r.owner_id is null or r.is_public = true)
  )
);

create policy "write own or anonymous pages" on public.report_pages for all using (
  exists (
    select 1 from public.reports r
    where r.project_id = report_pages.project_id
      and (r.owner_id = auth.uid() or r.owner_id is null)
  )
) with check (
  exists (
    select 1 from public.reports r
    where r.project_id = report_pages.project_id
      and (r.owner_id = auth.uid() or r.owner_id is null)
  )
);

create policy "read own or public datasets" on public.datasets for select using (
  exists (
    select 1 from public.reports r
    where r.project_id = datasets.project_id
      and (r.owner_id = auth.uid() or r.owner_id is null or r.is_public = true)
  )
);

create policy "write own or anonymous datasets" on public.datasets for all using (
  exists (
    select 1 from public.reports r
    where r.project_id = datasets.project_id
      and (r.owner_id = auth.uid() or r.owner_id is null)
  )
) with check (
  exists (
    select 1 from public.reports r
    where r.project_id = datasets.project_id
      and (r.owner_id = auth.uid() or r.owner_id is null)
  )
);

create policy "read own or public widgets" on public.widgets for select using (
  exists (
    select 1 from public.reports r
    where r.project_id = widgets.project_id
      and (r.owner_id = auth.uid() or r.owner_id is null or r.is_public = true)
  )
);

create policy "write own or anonymous widgets" on public.widgets for all using (
  exists (
    select 1 from public.reports r
    where r.project_id = widgets.project_id
      and (r.owner_id = auth.uid() or r.owner_id is null)
  )
) with check (
  exists (
    select 1 from public.reports r
    where r.project_id = widgets.project_id
      and (r.owner_id = auth.uid() or r.owner_id is null)
  )
);
