-- PedalPass — faculty/staff only need their ID (run AFTER 007)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Run it once.
--
-- What changes
--   • Students still submit 3 photos: school ID, COR and selfie.
--   • Faculty/staff (member_type = 'faculty') submit only their ID photo. Admins check that photo and the
--     name before approving — there is no face match for faculty.

create or replace function submit_verification() returns verification_status
language plpgsql security definer set search_path = public, storage as $$
declare
  uid uuid := auth.uid();
  faculty boolean;
  needed text[];
  uploaded int;
begin
  if uid is null then raise exception 'Not signed in'; end if;

  select member_type = 'faculty' into faculty from profiles where id = uid;
  needed := case
    when faculty then array[uid || '/id.jpg']
    else array[uid || '/id.jpg', uid || '/cor.jpg', uid || '/selfie.jpg']
  end;

  select count(*) into uploaded from storage.objects
  where bucket_id = 'verification' and name = any (needed);
  if uploaded < array_length(needed, 1) then
    raise exception '%', case when faculty then 'Upload your ID first' else 'Upload your school ID, COR and selfie first' end;
  end if;

  perform set_config('pedalpass.trusted_update', 'on', true);
  update profiles set
    verification_status = 'pending_review',
    consent_at = coalesce(consent_at, now()),
    submitted_at = now(),
    rejection_reason = null
  where id = uid and verification_status in ('needs_documents', 'rejected');

  return (select verification_status from profiles where id = uid);
end $$;
