-- Storage bucket policies for user-files
-- Creates RLS policies for the user-files storage bucket to allow authenticated users
-- to upload, download, and manage their own files

begin;

-- Ensure the bucket exists
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'user-files', 'user-files', false, 52428800, null -- 50MB limit, any mime type
where not exists (select 1 from storage.buckets where id = 'user-files');

-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Policy: Users can upload files to their own folder
create policy "Users can upload own files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'user-files' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can view their own files
create policy "Users can view own files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'user-files' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can update their own files
create policy "Users can update own files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'user-files' 
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'user-files' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own files
create policy "Users can delete own files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'user-files' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

commit;
