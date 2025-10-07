-- Encrypted user files metadata table and policies
-- Creates a table to track client-side encrypted files stored in Supabase Storage
-- and links them to users. Stores only encryption metadata, not ciphertext.

begin;

create table if not exists public.encrypted_user_files (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null,
  name varchar(255) not null,
  original_name varchar(255) not null,
  content_type varchar(255) not null,
  file_size bigint not null,
  storage_bucket text not null default 'user-files',
  storage_path text not null,
  -- encryption metadata (client-side generated)
  wrapped_dek text not null,
  dek_salt text not null,
  dek_iv text not null,
  data_iv text not null,
  kdf_algorithm text not null default 'pbkdf2',
  kdf_iterations integer not null default 100000,
  encryption_algorithm text not null default 'aes-256-gcm',
  -- optional hints/tags (non-sensitive)
  keyword_hints text[],
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists encrypted_user_files_user_id_idx on public.encrypted_user_files (user_id);
create index if not exists encrypted_user_files_created_at_idx on public.encrypted_user_files (created_at desc);
create index if not exists encrypted_user_files_bucket_path_idx on public.encrypted_user_files (storage_bucket, storage_path);

-- RLS
alter table public.encrypted_user_files enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'encrypted_user_files' and policyname = 'Users can manage own encrypted files'
  ) then
    create policy "Users can manage own encrypted files"
      on public.encrypted_user_files
      for all
      to public
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- updated_at trigger
create or replace function public.update_encrypted_user_files_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_encrypted_user_files_updated_at on public.encrypted_user_files;
create trigger update_encrypted_user_files_updated_at
before update on public.encrypted_user_files
for each row execute function public.update_encrypted_user_files_updated_at();

-- Ensure storage bucket row exists (id = name)
insert into storage.buckets (id, name, public)
select 'user-files', 'user-files', false
where not exists (select 1 from storage.buckets where id = 'user-files');

commit;


