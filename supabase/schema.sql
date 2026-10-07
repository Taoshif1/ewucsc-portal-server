-- EWUCSC Supabase schema
-- Run this once in the Supabase SQL Editor or apply it as a migration.

create table if not exists public.documents (
  id text not null,
  collection text not null check (length(collection) between 1 and 80),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists documents_collection_idx
  on public.documents (collection);

create index if not exists documents_collection_updated_idx
  on public.documents (collection, updated_at desc);

create unique index if not exists documents_ctf_solves_unique
  on public.documents ((data->>'challengeId'), (data->>'uid'))
  where collection = 'ctfSolves';

create unique index if not exists documents_homework_submissions_unique
  on public.documents ((data->>'homeworkId'), (data->>'uid'))
  where collection = 'homeworkSubmissions';

create unique index if not exists documents_content_slug_unique
  on public.documents (collection, (data->>'slug'))
  where collection in ('announcements', 'blogs');

create unique index if not exists documents_form_key_unique
  on public.documents ((data->>'formKey'))
  where collection = 'formDefinitions';

create unique index if not exists documents_site_settings_key_unique
  on public.documents ((data->>'key'))
  where collection = 'siteSettings';

create unique index if not exists documents_vp_resource_url_unique
  on public.documents ((data->>'resourceUrl'))
  where collection = 'vpResources';

create unique index if not exists documents_user_uid_unique
  on public.documents ((data->>'uid'))
  where collection = 'ewucscusers'
    and nullif(data->>'uid', '') is not null;

create unique index if not exists documents_user_email_unique
  on public.documents (lower(data->>'email'))
  where collection = 'ewucscusers'
    and nullif(data->>'email', '') is not null;

create unique index if not exists documents_user_student_id_unique
  on public.documents ((data->>'studentId'))
  where collection = 'ewucscusers'
    and nullif(data->>'studentId', '') is not null;

alter table public.documents enable row level security;

revoke all on table public.documents from anon, authenticated;
grant all on table public.documents to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('ewucsc-public', 'ewucsc-public', true, 10485760),
  ('ewucsc-private', 'ewucsc-private', false, 10485760)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;
