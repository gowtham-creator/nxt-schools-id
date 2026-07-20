-- Principal's signature image per school, shown on generated ID cards near the
-- "Principal" sign line. Uploaded from School Settings; stored in the public
-- `logos` bucket, its URL saved here.
alter table public.schools
  add column if not exists signature_url text;
