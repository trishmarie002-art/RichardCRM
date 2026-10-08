update storage.buckets set public=false,file_size_limit=52428800,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/quicktime','video/webm','video/x-m4v'] where id='customer-files';
alter policy customer_files_select on storage.objects using (
bucket_id='customer-files' and (storage.foldername(objects.name))[1]=(select auth.uid())::text
and exists(select 1 from public.leads l where l.id::text=(storage.foldername(objects.name))[2] and l.user_id=(select auth.uid())));
alter policy customer_files_insert on storage.objects with check (
bucket_id='customer-files' and (storage.foldername(objects.name))[1]=(select auth.uid())::text
and exists(select 1 from public.leads l where l.id::text=(storage.foldername(objects.name))[2] and l.user_id=(select auth.uid())));
alter policy customer_files_delete on storage.objects using (
bucket_id='customer-files' and (storage.foldername(objects.name))[1]=(select auth.uid())::text
and exists(select 1 from public.leads l where l.id::text=(storage.foldername(objects.name))[2] and l.user_id=(select auth.uid())));
