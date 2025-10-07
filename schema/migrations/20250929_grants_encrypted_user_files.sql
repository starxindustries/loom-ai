begin;

-- Ensure basic privileges are granted alongside RLS policies
grant select, insert, update, delete on table public.encrypted_user_files to anon;
grant select, insert, update, delete on table public.encrypted_user_files to authenticated;
grant select, insert, update, delete on table public.encrypted_user_files to service_role;

-- Also grant usage on schema if not already
grant usage on schema public to anon, authenticated, service_role;

commit;


