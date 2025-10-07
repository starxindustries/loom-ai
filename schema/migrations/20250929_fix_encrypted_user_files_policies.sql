begin;

-- Ensure RLS is enabled
alter table public.encrypted_user_files enable row level security;

-- Drop the broad policy if it exists
do $$ begin
  if exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'encrypted_user_files' 
      and policyname = 'Users can manage own encrypted files'
  ) then
    drop policy "Users can manage own encrypted files" on public.encrypted_user_files;
  end if;
end $$;

-- Create explicit policies for each action to the authenticated role
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'encrypted_user_files' 
      and policyname = 'encrypted_user_files_select_own'
  ) then
create policy encrypted_user_files_select_own
  on public.encrypted_user_files
  for select
  to public
  using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'encrypted_user_files' 
      and policyname = 'encrypted_user_files_insert_own'
  ) then
create policy encrypted_user_files_insert_own
  on public.encrypted_user_files
  for insert
  to public
  with check (
    (auth.uid() = user_id)
    or ((auth.jwt() ->> 'role') = 'service_role')
  );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'encrypted_user_files' 
      and policyname = 'encrypted_user_files_update_own'
  ) then
create policy encrypted_user_files_update_own
  on public.encrypted_user_files
  for update
  to public
  using ((auth.uid() = user_id) or ((auth.jwt() ->> 'role') = 'service_role'))
  with check ((auth.uid() = user_id) or ((auth.jwt() ->> 'role') = 'service_role'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'encrypted_user_files' 
      and policyname = 'encrypted_user_files_delete_own'
  ) then
create policy encrypted_user_files_delete_own
  on public.encrypted_user_files
  for delete
  to public
  using (auth.uid() = user_id);
  end if;
end $$;

commit;


