-- PedalPass — identity verification (run AFTER schema.sql)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Run it once.
--
-- What changes
--   • Any email can register (school or personal). The 6-digit email code still proves the email is theirs.
--   • Riders upload 3 photos — school ID, COR (Certificate of Registration) and a selfie —
--     to a PRIVATE storage bucket. Only the rider and staff can see them.
--   • Admin or security staff compare the selfie with the ID photo and approve or reject in the web portal.
--   • Only approved riders can start a ride.
--
-- Photo paths are fixed: verification/<user id>/id.jpg, cor.jpg, selfie.jpg

-- ───────────────────────── Profile columns ─────────────────────────
create type verification_status as enum ('needs_documents', 'pending_review', 'approved', 'rejected');

alter table profiles
  add column verification_status verification_status not null default 'needs_documents',
  add column consent_at timestamptz,             -- when the rider agreed to the Data Privacy notice
  add column submitted_at timestamptz,
  add column reviewed_by uuid references profiles (id) on delete set null,
  add column reviewed_at timestamptz,
  add column rejection_reason text;

create index profiles_pending_review on profiles (submitted_at) where verification_status = 'pending_review';

-- Staff accounts don't need to upload documents
update profiles set verification_status = 'approved', is_verified = true
where role in ('security', 'maintenance', 'admin');

-- ───────────────────────── Sign-up: allow any email ─────────────────────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := coalesce(meta ->> 'role', 'student');
begin
  insert into profiles (id, email, name, role, student_id, course, year_level, section, department)
  values (
    new.id,
    lower(new.email),
    coalesce(meta ->> 'name', split_part(new.email, '@', 1)),
    case when wanted = 'faculty' then 'faculty'::user_role else 'student'::user_role end,
    meta ->> 'student_id',
    meta ->> 'course',
    meta ->> 'year_level',
    meta ->> 'section',
    meta ->> 'department'
  );
  return new;
end $$;

-- ───────────────────────── Protect verification fields ─────────────────────────
-- Riders may edit their own profile, but never their role, approval or review fields.
-- The submit/review functions below set a flag so their own updates are allowed through.
create or replace function protect_profile_fields() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null
     and my_role() <> 'admin'
     and coalesce(current_setting('pedalpass.trusted_update', true), '') <> 'on' then
    new.role := old.role;
    new.is_verified := old.is_verified;
    new.email := old.email;
    new.verification_status := old.verification_status;
    new.consent_at := old.consent_at;
    new.submitted_at := old.submitted_at;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.rejection_reason := old.rejection_reason;
  end if;
  return new;
end $$;

-- ───────────────────────── Private photo storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification', 'verification', false, 5242880, array['image/jpeg', 'image/png']);

-- Riders can upload/replace/view/delete only files in their own folder (<user id>/...).
-- Upsert (replacing a photo) needs insert + select + update.
create policy "verification: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "verification: read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'verification' and ((storage.foldername(name))[1] = (select auth.uid())::text or is_staff()));
create policy "verification: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'verification' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "verification: delete own or staff" on storage.objects for delete to authenticated
  using (bucket_id = 'verification' and ((storage.foldername(name))[1] = (select auth.uid())::text or is_staff()));

-- ───────────────────────── Submit for review (rider) ─────────────────────────
-- supabase.rpc('submit_verification') — call after uploading all 3 photos.
create function submit_verification() returns verification_status
language plpgsql security definer set search_path = public, storage as $$
declare
  uid uuid := auth.uid();
  uploaded int;
begin
  if uid is null then raise exception 'Not signed in'; end if;

  select count(*) into uploaded from storage.objects
  where bucket_id = 'verification'
    and name in (uid || '/id.jpg', uid || '/cor.jpg', uid || '/selfie.jpg');
  if uploaded < 3 then raise exception 'Upload your school ID, COR and selfie first'; end if;

  perform set_config('pedalpass.trusted_update', 'on', true);
  update profiles set
    verification_status = 'pending_review',
    consent_at = coalesce(consent_at, now()),
    submitted_at = now(),
    rejection_reason = null
  where id = uid and verification_status in ('needs_documents', 'rejected');

  return (select verification_status from profiles where id = uid);
end $$;

-- ───────────────────────── Approve / reject (admin or security) ─────────────────────────
-- supabase.rpc('review_verification', { p_user_id, p_approve: true|false, p_reason: '...' })
create function review_verification(p_user_id uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(my_role() not in ('admin', 'security'), true) then
    raise exception 'Only admin or security staff can review';
  end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then
    raise exception 'Give a reason when rejecting';
  end if;

  perform set_config('pedalpass.trusted_update', 'on', true);
  update profiles set
    verification_status = case when p_approve then 'approved'::verification_status else 'rejected'::verification_status end,
    is_verified = p_approve,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = case when p_approve then null else trim(p_reason) end
  where id = p_user_id and verification_status = 'pending_review';

  if not found then raise exception 'This account is not waiting for review'; end if;
end $$;

-- These functions must not be callable without signing in
revoke execute on function submit_verification() from anon, public;
revoke execute on function review_verification(uuid, boolean, text) from anon, public;
grant execute on function submit_verification() to authenticated;
grant execute on function review_verification(uuid, boolean, text) to authenticated;

-- ───────────────────────── Only approved riders can ride ─────────────────────────
create or replace function start_ride(p_bike_id text) returns rides
language plpgsql security definer set search_path = public as $$
declare
  b bikes;
  r rides;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and verification_status = 'approved') then
    raise exception 'Your account is waiting for identity approval';
  end if;

  select * into b from bikes where id = p_bike_id for update;
  if not found then raise exception 'Bike % not found', p_bike_id; end if;
  if b.status <> 'available' then raise exception '% is not available right now', p_bike_id; end if;

  update bikes set status = 'in_use', updated_at = now() where id = p_bike_id;
  insert into rides (user_id, bike_id, from_location)
  values (auth.uid(), p_bike_id, b.station || ' ' || b.bay)
  returning * into r;
  return r;
end $$;
