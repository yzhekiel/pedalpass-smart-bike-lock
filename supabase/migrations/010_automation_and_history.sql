-- PedalPass — automatic bike statuses, activity log, QR regeneration, swaps, maintenance staff, parts usage
-- (run AFTER 009)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Run it once.
--
-- What changes
--   • Activity log: rides, returns, cancellations, issue reports, repairs, staff assignment, bike status
--     changes, QR regeneration, swaps, parts used and identity reviews are recorded automatically.
--     Admins read it in the web portal; nobody can edit or delete it.
--   • Bike statuses follow what actually happens:
--       - any issue report on an available bike → Under Inspection (unsafe / P1 → Maintenance)
--       - ride returned in good condition → Available, unless the bike still has an open ticket
--       - ride returned with a minor issue → Under Inspection; unsafe → Maintenance
--       - ticket "Scheduled for Overhaul" → Maintenance
--       - last open ticket resolved → Available (this used to be done by the web page)
--   • Low lock battery: bikes under 20% cannot be borrowed (change min_ride_battery() to adjust).
--   • QR codes carry a secret code. start_ride only accepts the current one, and an admin can
--     regenerate a bike's code so the old printed QR stops working. Print the new codes from the
--     web portal's QR Codes page — the old test-qr-codes/*.png images stop working after this file.
--   • swap_bike(): end the current ride and start another bike in one step, with a reason. The old
--     bike gets a ticket and goes Under Inspection.
--   • Maintenance staff list with contact details; tickets can be assigned to them.
--   • Parts used on a ticket are taken out of stock automatically; stock status and the percentage
--     bar follow the stock, and a low-stock alert is raised when an item reaches its reorder level.

-- ───────────────────────── Activity log ─────────────────────────
create table activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  action text not null,                -- ride_started, ride_ended, issue_reported, qr_regenerated, ...
  status text,                         -- the result, e.g. 'Completed', 'inspection', 'Resolved'
  bike_id text references bikes (id) on delete set null,
  user_id uuid references profiles (id) on delete set null,  -- the rider involved
  user_name text,
  actor_id uuid,                       -- who did it (null = the system)
  actor_name text,
  details text
);
create index activity_log_created on activity_log (created_at desc);
create index activity_log_bike on activity_log (bike_id, created_at desc);
create index activity_log_user on activity_log (user_id, created_at desc);

alter table activity_log enable row level security;
create policy "activity_log: admin read" on activity_log for select to authenticated using ((select is_staff()));
-- No insert/update/delete policies: only the triggers below write it.

create function log_activity(p_action text, p_status text, p_bike_id text, p_user_id uuid, p_details text)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- The subqueries drop references to rows being deleted (e.g. a deleted account's rides), so logging
  -- never blocks a delete.
  insert into activity_log (action, status, bike_id, user_id, user_name, actor_id, actor_name, details)
  values (
    p_action, p_status,
    (select id from bikes where id = p_bike_id),
    (select id from profiles where id = p_user_id),
    (select name from profiles where id = p_user_id),
    auth.uid(),
    coalesce((select name from profiles where id = auth.uid()), 'System'),
    p_details
  );
end $$;
revoke execute on function log_activity(text, text, text, uuid, text) from public, anon, authenticated;

-- ───────────────────────── QR codes (secret part kept private) ─────────────────────────
-- QR text: PEDALPASS:<bike id>:<code>, e.g. PEDALPASS:BP-001:3f9a0c41d2e8b7a65c
-- (003 normally creates these two already; repeated here so this file also works without it)
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.bike_qr (
  bike_id text primary key references public.bikes (id) on delete cascade,
  token text not null default encode(extensions.gen_random_bytes(9), 'hex'),
  version int not null default 1,
  updated_at timestamptz not null default now()
);
alter table private.bike_qr enable row level security; -- no policies: only the functions below can read it
insert into private.bike_qr (bike_id) select id from bikes;

-- supabase.rpc('bike_qr_codes') — admins: the current QR text of every bike, for printing.
create function bike_qr_codes() returns table (bike_id text, payload text, version int, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_staff() then raise exception 'Only admins can view QR codes'; end if;
  insert into private.bike_qr (bike_id) select b.id from bikes b on conflict do nothing; -- bikes added later
  return query
    select q.bike_id, 'PEDALPASS:' || q.bike_id || ':' || q.token, q.version, q.updated_at
    from private.bike_qr q order by q.bike_id;
end $$;

-- supabase.rpc('regenerate_bike_qr', { p_bike_id }) — admins: new code, the old printed QR stops working.
create function regenerate_bike_qr(p_bike_id text) returns text
language plpgsql security definer set search_path = public as $$
declare
  payload text;
  v int;
begin
  if not is_staff() then raise exception 'Only admins can regenerate QR codes'; end if;
  insert into private.bike_qr as q (bike_id) values (p_bike_id)
  on conflict (bike_id) do update
    set token = encode(extensions.gen_random_bytes(9), 'hex'), version = q.version + 1, updated_at = now()
  returning 'PEDALPASS:' || q.bike_id || ':' || q.token, q.version into payload, v;
  perform log_activity('qr_regenerated', 'v' || v, p_bike_id, null, 'Old QR code no longer works');
  return payload;
end $$;

-- ───────────────────────── Rides ─────────────────────────
-- Lowest lock battery (percent) a bike may be borrowed with.
create function min_ride_battery() returns int language sql immutable as $$ select 20 $$;

-- supabase.rpc('start_ride', { p_bike_id: 'BP-001', p_qr_token: '<code from the QR>' })
drop function if exists start_ride(text);
create function start_ride(p_bike_id text, p_qr_token text) returns rides
language plpgsql security definer set search_path = public as $$
declare
  b bikes;
  r rides;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and verification_status = 'approved') then
    raise exception 'Your account is waiting for identity approval';
  end if;
  if coalesce(p_qr_token, '') = '' then raise exception 'Scan the QR code on the bike to unlock it'; end if;
  if not exists (select 1 from private.bike_qr q where q.bike_id = p_bike_id and q.token = p_qr_token) then
    raise exception 'This QR code is no longer valid. Ask an admin for a new QR code for %', p_bike_id;
  end if;

  select * into b from bikes where id = p_bike_id for update;
  if not found then raise exception 'Bike % not found', p_bike_id; end if;
  if b.status <> 'available' then raise exception '% is not available right now', p_bike_id; end if;
  if b.battery < min_ride_battery() then
    raise exception '% has a low lock battery (% percent). Please choose another bike.', p_bike_id, b.battery;
  end if;

  update bikes set status = 'in_use', updated_at = now() where id = p_bike_id;
  insert into rides (user_id, bike_id, from_location)
  values (auth.uid(), p_bike_id, b.station || ' ' || b.bay)
  returning * into r;
  return r;
end $$;

-- Same as schema.sql, except the bike only becomes available when it came back in good condition
-- and has no open ticket.
create or replace function end_ride(p_ride_id uuid, p_condition text, p_to_location text default null) returns rides
language plpgsql security definer set search_path = public as $$
declare
  r rides;
  mins int;
begin
  select * into r from rides where id = p_ride_id and user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'No active ride found'; end if;

  mins := greatest(1, round(extract(epoch from (now() - r.started_at)) / 60)::int);

  update rides set
    ended_at = now(),
    to_location = coalesce(p_to_location, r.from_location),
    duration_min = mins,
    distance_km = round(mins * 0.25, 1),
    status = case when p_condition = 'good' then 'Completed'::ride_status else 'Issue Reported'::ride_status end,
    note = case p_condition
      when 'minor' then 'Minor issue noted by rider'
      when 'damaged' then 'Rider reported: needs repair'
    end
  where id = p_ride_id
  returning * into r;

  update bikes
  set status = case
        when p_condition = 'damaged' then 'maintenance'::bike_status
        when p_condition = 'minor'
          or exists (select 1 from work_orders w where w.bike_id = r.bike_id and w.status <> 'Resolved')
          then 'inspection'::bike_status
        else 'available'::bike_status
      end,
      updated_at = now()
  where id = r.bike_id;

  return r;
end $$;

-- ───────────────────────── Bike swaps ─────────────────────────
create table bike_swaps (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  old_ride_id uuid references rides (id) on delete set null,
  new_ride_id uuid references rides (id) on delete set null,
  old_bike_id text not null references bikes (id),
  new_bike_id text not null references bikes (id),
  reason text not null,
  created_at timestamptz not null default now()
);
alter table bike_swaps enable row level security;
create policy "bike_swaps: read own or staff" on bike_swaps for select to authenticated
  using (user_id = (select auth.uid()) or (select is_staff()));

-- supabase.rpc('swap_bike', { p_ride_id, p_new_bike_id, p_qr_token, p_reason })
-- Ends the current ride, sends the old bike to inspection with a ticket and starts the new bike.
-- If the new bike can't be started, nothing changes. The app then gets an unlock token for the new ride.
create function swap_bike(p_ride_id uuid, p_new_bike_id text, p_qr_token text, p_reason text) returns rides
language plpgsql security definer set search_path = public as $$
declare
  old_r rides;
  new_r rides;
  why text := trim(coalesce(p_reason, ''));
begin
  if why = '' then raise exception 'Say why you are swapping bikes'; end if;
  select * into old_r from rides where id = p_ride_id and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'No active ride found'; end if;
  if old_r.bike_id = p_new_bike_id then raise exception 'Scan a different bike to swap'; end if;

  old_r := end_ride(p_ride_id, 'minor');
  update rides set note = 'Swapped to ' || p_new_bike_id || ': ' || why where id = old_r.id;
  -- station, bay and reporter are filled in by work_order_set_server_fields
  insert into work_orders (bike_id, station, bay, priority, issue_title, reported_by, reporter_id)
  values (old_r.bike_id, '', '', 'P2', 'Bike swap: ' || why, '', auth.uid());

  new_r := start_ride(p_new_bike_id, p_qr_token);
  insert into bike_swaps (user_id, old_ride_id, new_ride_id, old_bike_id, new_bike_id, reason)
  values (auth.uid(), old_r.id, new_r.id, old_r.bike_id, p_new_bike_id, why);
  perform log_activity('bike_swapped', 'active', p_new_bike_id, auth.uid(), old_r.bike_id || ' → ' || p_new_bike_id || ': ' || why);
  return new_r;
end $$;

-- ───────────────────────── Tickets set the bike's status ─────────────────────────
-- Replaces the P1-only rule from schema.sql (same trigger, work_orders_p1_maintenance):
-- an available bike with any report goes Under Inspection; P1 (unsafe) takes it to Maintenance.
-- A bike someone is riding is left alone — end_ride sees the open ticket when it comes back.
create or replace function work_order_sets_bike_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.priority = 'P1' then
    update bikes set status = 'maintenance', updated_at = now()
    where id = new.bike_id and status in ('available', 'inspection');
  else
    update bikes set status = 'inspection', updated_at = now()
    where id = new.bike_id and status = 'available';
  end if;
  return new;
end $$;

create function work_order_status_sets_bike() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Resolved' then
    if not exists (select 1 from work_orders w where w.bike_id = new.bike_id and w.status <> 'Resolved' and w.id <> new.id) then
      update bikes set status = 'available', updated_at = now()
      where id = new.bike_id and status in ('inspection', 'maintenance');
    end if;
  elsif new.status = 'Scheduled for Overhaul' then
    update bikes set status = 'maintenance', updated_at = now()
    where id = new.bike_id and status in ('available', 'inspection');
  end if;
  return new;
end $$;

create trigger work_orders_status_bike
  after update of status on work_orders
  for each row when (new.status is distinct from old.status)
  execute function work_order_status_sets_bike();

-- ───────────────────────── Maintenance staff ─────────────────────────
create table maintenance_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  specialty text,                      -- e.g. 'Brakes & tires', 'Smart locks / electronics'
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table maintenance_staff enable row level security;
create policy "maintenance_staff: admin" on maintenance_staff for all to authenticated
  using ((select is_staff())) with check ((select is_staff()));

alter table work_orders add column assigned_staff_id uuid references maintenance_staff (id) on delete set null;

-- Assigning a staff member also fills the technician name shown on the ticket.
create function work_order_fill_assignee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.assigned_tech := (select name from maintenance_staff where id = new.assigned_staff_id);
  return new;
end $$;

create trigger work_orders_assignee
  before update of assigned_staff_id on work_orders
  for each row when (new.assigned_staff_id is distinct from old.assigned_staff_id)
  execute function work_order_fill_assignee();

-- ───────────────────────── Parts inventory ─────────────────────────
-- full_stock = the stock level that counts as 100% (worked out from the current percentage).
alter table inventory add column full_stock int check (full_stock > 0);
update inventory set full_stock = greatest(stock, ceil(stock * 100.0 / nullif(percentage, 0))::int, 1);

create function inventory_stock_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reorder int := coalesce(new.reorder_threshold, 3);
begin
  new.full_stock := coalesce(new.full_stock, greatest(new.stock, 1));
  new.percentage := least(100, round(new.stock * 100.0 / new.full_stock));
  new.status_type := case
    when new.stock <= reorder / 2 then 'critical'::stock_status
    when new.stock <= reorder then 'warning'::stock_status
    else 'good'::stock_status
  end;
  new.status_tag := case
    when new.stock = 0 then 'Out of stock'
    when new.stock <= reorder / 2 then 'Restock now'
    when new.stock <= reorder then 'Reorder level: ' || reorder
    else 'Healthy'
  end;

  if tg_op = 'UPDATE' and new.stock <= reorder and old.stock > reorder then
    insert into alerts (type, message)
    values ('low_stock', new.name || ': ' || new.stock || ' ' || new.unit || ' left (reorder level ' || reorder || ')');
  end if;
  return new;
end $$;

create trigger inventory_status
  before insert or update of stock, reorder_threshold, full_stock on inventory
  for each row execute function inventory_stock_status();

update inventory set stock = stock; -- recompute status, tag and percentage for the current rows

create table parts_used (
  id bigint generated always as identity primary key,
  work_order_id text not null references work_orders (id) on delete cascade,
  inventory_id text not null references inventory (id),
  quantity int not null check (quantity > 0),
  used_by uuid default auth.uid() references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index parts_used_order on parts_used (work_order_id);
alter table parts_used enable row level security;
create policy "parts_used: admin" on parts_used for all to authenticated
  using ((select is_staff())) with check ((select is_staff()));

-- Recording parts on a ticket takes them out of stock (and refuses if there are not enough).
create function parts_used_take_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  part inventory;
  w work_orders;
begin
  update inventory set stock = stock - new.quantity
  where id = new.inventory_id and stock >= new.quantity
  returning * into part;
  if not found then
    raise exception 'Not enough % in stock', coalesce((select name from inventory where id = new.inventory_id), new.inventory_id);
  end if;
  select * into w from work_orders where id = new.work_order_id;
  perform log_activity('parts_used', w.status::text, w.bike_id, null,
    new.quantity || ' × ' || part.name || ' on ' || w.id || ' (' || part.stock || ' left)');
  return new;
end $$;

create trigger parts_used_stock
  before insert on parts_used
  for each row execute function parts_used_take_stock();

-- ───────────────────────── Write the activity log ─────────────────────────
create function rides_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_activity('ride_started', 'active', new.bike_id, new.user_id, 'From ' || new.from_location);
  elsif tg_op = 'DELETE' then
    perform log_activity('ride_cancelled', 'cancelled', old.bike_id, old.user_id, 'Lock did not open');
  elsif old.status = 'active' and new.status <> 'active' then
    perform log_activity('ride_ended', new.status::text, new.bike_id, new.user_id,
      coalesce(new.duration_min::text, '?') || ' min' || coalesce(' • ' || new.note, ''));
  end if;
  return null;
end $$;
create trigger rides_activity after insert or update or delete on rides
  for each row execute function rides_log();

create function work_orders_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_activity('issue_reported', new.status::text, new.bike_id, new.reporter_id,
      new.id || ' (' || new.priority || '): ' || new.issue_title);
  elsif new.status is distinct from old.status then
    perform log_activity(case when new.status = 'Resolved' then 'issue_resolved' else 'maintenance_update' end,
      new.status::text, new.bike_id, new.reporter_id,
      new.id || coalesce(' • ' || new.assigned_tech, '') || coalesce(' • ' || new.resolution_notes, ''));
  elsif new.assigned_staff_id is distinct from old.assigned_staff_id then
    perform log_activity('maintenance_assigned', new.status::text, new.bike_id, new.reporter_id,
      new.id || ' → ' || coalesce(new.assigned_tech, 'unassigned'));
  end if;
  return null;
end $$;
create trigger work_orders_activity after insert or update on work_orders
  for each row execute function work_orders_log();

-- Start/end of a ride already appear as ride_started / ride_ended, so available ↔ in_use is skipped.
create function bikes_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and not (old.status in ('available', 'in_use') and new.status in ('available', 'in_use')) then
    perform log_activity('bike_status_changed', new.status::text, new.id, null, old.status || ' → ' || new.status);
  end if;
  return null;
end $$;
create trigger bikes_activity after update of status on bikes
  for each row execute function bikes_log();

create function profiles_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform log_activity('identity_' || new.verification_status, new.verification_status::text, null, new.id, new.rejection_reason);
  return null;
end $$;
create trigger profiles_activity after update of verification_status on profiles
  for each row when (new.verification_status is distinct from old.verification_status)
  execute function profiles_log();

-- ───────────────────────── Who may call the new functions ─────────────────────────
revoke execute on function bike_qr_codes() from public, anon;
revoke execute on function regenerate_bike_qr(text) from public, anon;
revoke execute on function start_ride(text, text) from public, anon;
revoke execute on function swap_bike(uuid, text, text, text) from public, anon;
grant execute on function bike_qr_codes() to authenticated;
grant execute on function regenerate_bike_qr(text) to authenticated;
grant execute on function start_ride(text, text) to authenticated;
grant execute on function swap_bike(uuid, text, text, text) to authenticated;
