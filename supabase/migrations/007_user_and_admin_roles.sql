-- PedalPass — just two roles: User and Admin (run AFTER 006)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Run it once.
--
-- What changes
--   • Role "student" is renamed "user". Faculty become "user" too; whether someone is a student or
--     faculty member is kept in the new member_type column (shown to staff and on issue reports).
--   • Security and maintenance staff become "admin". Admins do everything in the web portal:
--     identity approvals, fleet, SOS alerts, repairs and parts.
--   • New accounts can only be "user"; make someone an admin in the SQL Editor:
--       update profiles set role = 'admin', verification_status = 'approved', is_verified = true
--       where email = 'someone@example.com';
-- The old role names stay inside the user_role type (Postgres can't remove them), but a check
-- constraint stops them from being used.

-- ───────────────────────── Roles ─────────────────────────
alter table profiles add column member_type text not null default 'student'
  check (member_type in ('student', 'faculty'));
update profiles set member_type = 'faculty' where role = 'faculty';

alter type user_role rename value 'student' to 'user';
update profiles set role = 'user' where role = 'faculty';
update profiles set role = 'admin', verification_status = 'approved', is_verified = true
where role in ('security', 'maintenance');

alter table profiles alter column role set default 'user';
alter table profiles add constraint profiles_role_user_or_admin check (role in ('user', 'admin'));

-- ───────────────────────── Sign-up ─────────────────────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into profiles (id, email, name, role, member_type, student_id, course, year_level, section, department)
  values (
    new.id,
    lower(new.email),
    coalesce(meta ->> 'name', split_part(new.email, '@', 1)),
    'user',
    case when meta ->> 'member_type' = 'faculty' or meta ->> 'role' = 'faculty' then 'faculty' else 'student' end,
    meta ->> 'student_id',
    meta ->> 'course',
    meta ->> 'year_level',
    meta ->> 'section',
    meta ->> 'department'
  );
  return new;
end $$;

-- ───────────────────────── Staff = admin ─────────────────────────
create or replace function is_staff() returns boolean
language sql stable as $$
  select coalesce(my_role() = 'admin', false)
$$;

create or replace function can_review_identity() returns boolean
language sql stable as $$
  select coalesce(my_role() = 'admin', false)
$$;

create or replace function review_verification(p_user_id uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(my_role() <> 'admin', true) then
    raise exception 'Only admins can review';
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

-- Users must not change their own role, approval or student/faculty type
create or replace function protect_profile_fields() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null
     and my_role() <> 'admin'
     and coalesce(current_setting('pedalpass.trusted_update', true), '') <> 'on' then
    new.role := old.role;
    new.member_type := old.member_type;
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

-- ───────────────────────── Issue reports ─────────────────────────
-- Same as 004, but the reporter shows as "(Student)" / "(Faculty)" instead of "(User)"
create or replace function work_order_set_server_fields() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  b bikes;
  p profiles;
begin
  if auth.uid() is null then return new; end if; -- SQL Editor / service scripts

  new.id := 'TKT-' || nextval('work_order_seq');
  new.created_at := now();
  new.resolved_at := null;
  if is_staff() then return new; end if;

  select * into b from bikes where id = new.bike_id;
  if not found then raise exception 'Bike % not found', new.bike_id; end if;
  select * into p from profiles where id = auth.uid();

  new.reporter_id := auth.uid();
  new.reported_by := p.name || ' (' || initcap(p.member_type) || ')';
  new.station := b.station;
  new.bay := b.bay;
  new.node_id := b.node_id;
  new.status := 'Reported / Queued';
  new.assigned_tech := null;
  new.parts_allocated := null;
  new.photo_url := null;

  if new.priority = 'P1' and not exists (
    select 1 from rides
    where user_id = auth.uid()
      and bike_id = new.bike_id
      and (status = 'active' or ended_at > now() - interval '1 hour')
  ) then
    new.priority := 'P2';
  end if;
  return new;
end $$;
