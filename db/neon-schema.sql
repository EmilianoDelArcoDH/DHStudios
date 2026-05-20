create extension if not exists "pgcrypto";

create table if not exists app_reports (
  project_id uuid primary key,
  editor_key text not null,
  name text not null,
  is_public boolean not null default false,
  report jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_reports_public_idx on app_reports (is_public, updated_at desc);
