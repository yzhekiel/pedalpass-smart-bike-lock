-- PedalPass — tighter privacy and safer issue reports (run AFTER 003)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Run it once.
--
-- What changes
--   • Only admin and security staff can see riders' profiles and their ID / COR / selfie photos.
--     Maintenance staff no longer can (Data Privacy Act, RA 10173). Everyone still sees their own profile.
--   • Riders can only add, replace or delete their photos before submitting (or after a rejection),
--     so the photos cannot be swapped while staff are reviewing them.
--   • Issue reports from riders: the database fills in the ticket number, reporter, location and status,
--     so they cannot be faked. A rider's "Unsafe to ride" (P1) report only takes the bike out of service
--     if they are riding it or rode it in the last hour; otherwise it is saved as P2 for maintenance to check.

-- ───────────────────────── Who may see identity data ─────────────────────────
create function can_review_identity() returns boolean
language sql stable as $$
  select coalesce(my_role() in ('admin', 'security'), false)
$$;

-- True while the signed-in rider is allowed to change their verification photos.
create function can_change_verification_photos() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and verification_status in ('needs_documents', 'rejected')
  )
$$;

-- ───────────────────────── Profiles ─────────────────────────
drop policy "profiles: read own or staff" on profiles;
create policy "profiles: read own or reviewers" on profiles for select to authenticated
  using (id = (select auth.uid()) or (select can_review_identity()));

-- ───────────────────────── Verification photos ─────────────────────────
drop policy "verification: upload own" on storage.objects;
drop policy "verification: read own or staff" on storage.objects;
drop policy "verification: replace own" on storage.objects;
drop policy "verification: delete own or staff" on storage.objects;

create policy "verification: upload own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select can_change_verification_photos())
  );
create policy "verification: read own or reviewers" on storage.objects for select to authenticated
  using (
    bucket_id = 'verification'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select can_review_identity()))
  );
create policy "verification: replace own" on storage.objects for update to authenticated
  using (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select can_change_verification_photos())
  )
  with check (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select can_change_verification_photos())
  );
create policy "verification: delete own or reviewers" on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and (select can_change_verification_photos()))
      or (select can_review_identity())
    )
  );

-- ───────────────────────── Issue reports ─────────────────────────
-- Runs before the insert (and before the security rule check), so whatever the app sends for these
-- fields is replaced. Staff reports keep their own location/status/technician (they may find a bike
-- away from its bay), but still get a ticket number from the sequence.
create function work_order_set_server_fields() returns trigger
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
  new.reported_by := p.name || ' (' || initcap(p.role::text) || ')';
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

create trigger work_orders_server_fields
  before insert on work_orders
  for each row execute function work_order_set_server_fields();
