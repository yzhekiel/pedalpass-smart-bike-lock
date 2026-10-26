-- PedalPass database (Supabase / Postgres)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
-- Run it once on a fresh project. Sample data (same as the apps' mockData.ts) is at the bottom.
--
-- Tables
--   profiles     one row per signed-in user (students, faculty, staff), linked to auth.users
--   stations     docking hubs
--   bikes        the fleet (id = the code printed on the QR, e.g. 'BP-001')
--   rides        one row per ride (start → end)
--   work_orders  issue reports / repair tickets
--   inventory    depot spare parts
--   alerts       SOS and other alerts for campus security

-- ───────────────────────── Types ─────────────────────────
create type user_role as enum ('student', 'faculty', 'security', 'maintenance', 'admin');
create type bike_status as enum ('available', 'in_use', 'maintenance', 'locked');
create type station_status as enum ('optimal', 'warning', 'offline');
create type ride_status as enum ('active', 'Completed', 'Issue Reported');
create type ticket_priority as enum ('P1', 'P2', 'P3');
create type ticket_status as enum ('Reported / Queued', 'Under Inspection', 'Scheduled for Overhaul', 'Resolved');
create type stock_status as enum ('good', 'warning', 'critical', 'normal');

-- ───────────────────────── Tables ─────────────────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role user_role not null default 'student',
  email text not null unique,
  student_id text,
  course text,
  year_level text,
  section text,
  title text,
  department text,
  avatar_url text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table stations (
  id text primary key,                 -- 'st-01'
  name text not null,
  code text not null unique,           -- 'MG-01'
  total_bays int not null check (total_bays >= 0),
  node_id text,
  status station_status not null default 'optimal',
  status_message text
);

create table bikes (
  id text primary key,                 -- 'BP-001' (matches the QR code)
  model text not null,
  battery int not null default 100 check (battery between 0 and 100),
  range_km int not null default 0,
  station text not null,               -- display name, e.g. 'Main Gate Station'
  bay text not null,
  status bike_status not null default 'available',
  image_url text,
  node_id text not null,               -- smart lock id, e.g. 'PP-LOCK-001'
  updated_at timestamptz not null default now()
);

create table rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  bike_id text not null references bikes (id),
  from_location text not null,
  to_location text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_min int,
  distance_km numeric(5, 1),
  status ride_status not null default 'active',
  note text
);
-- A rider can only have one active ride, and a bike can only be in one active ride.
create unique index rides_one_active_per_user on rides (user_id) where status = 'active';
create unique index rides_one_active_per_bike on rides (bike_id) where status = 'active';
create index rides_user_started on rides (user_id, started_at desc);

create sequence work_order_seq start 900;
create table work_orders (
  id text primary key default ('TKT-' || nextval('work_order_seq')),
  bike_id text not null references bikes (id),
  station text not null,
  bay text not null,
  priority ticket_priority not null default 'P2',
  issue_title text not null,
  reported_by text not null,           -- display text, e.g. 'Gabriel Santos (Student)'
  reporter_id uuid references profiles (id) on delete set null,
  status ticket_status not null default 'Reported / Queued',
  assigned_tech text,
  parts_allocated text,
  node_id text,
  photo_url text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table inventory (
  id text primary key,                 -- 'inv-01'
  name text not null,
  description text,
  stock int not null default 0 check (stock >= 0),
  unit text not null default 'units',
  percentage int not null default 0 check (percentage between 0 and 100),
  status_tag text,
  status_type stock_status not null default 'normal',
  reorder_threshold int
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'sos',    -- 'sos', 'late_return', 'low_battery', ...
  user_id uuid references profiles (id) on delete set null,
  bike_id text references bikes (id),
  message text,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

-- ───────────────────────── Sign-up ─────────────────────────
-- When someone signs up (supabase.auth.signUp), create their profile from the
-- metadata the app sends. Only @dyci.edu.ph emails are allowed, and self sign-up
-- can only pick student or faculty — staff roles are given by an admin.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := coalesce(meta ->> 'role', 'student');
begin
  if lower(new.email) not like '%@dyci.edu.ph' then
    raise exception 'Only @dyci.edu.ph email addresses can register';
  end if;
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Role of the signed-in user (used by the security rules below).
create function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create function is_staff() returns boolean
language sql stable as $$
  select coalesce(my_role() in ('security', 'maintenance', 'admin'), false)
$$;

-- Stop users from changing their own role or verified flag.
create function protect_profile_fields() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and my_role() <> 'admin' then
    new.role := old.role;
    new.is_verified := old.is_verified;
    new.email := old.email;
  end if;
  return new;
end $$;

create trigger profiles_protect_fields
  before update on profiles
  for each row execute function protect_profile_fields();

-- ───────────────────────── Ride functions ─────────────────────────
-- Starting/ending a ride touches two tables (rides + bikes), so the app calls these
-- functions instead of writing the tables directly. They run as one transaction.

-- supabase.rpc('start_ride', { p_bike_id: 'BP-001' })
create function start_ride(p_bike_id text) returns rides
language plpgsql security definer set search_path = public as $$
declare
  b bikes;
  r rides;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select * into b from bikes where id = p_bike_id for update;
  if not found then raise exception 'Bike % not found', p_bike_id; end if;
  if b.status <> 'available' then raise exception '% is not available right now', p_bike_id; end if;

  update bikes set status = 'in_use', updated_at = now() where id = p_bike_id;
  insert into rides (user_id, bike_id, from_location)
  values (auth.uid(), p_bike_id, b.station || ' ' || b.bay)
  returning * into r;
  return r;
end $$;

-- supabase.rpc('end_ride', { p_ride_id, p_condition: 'good' | 'minor' | 'damaged', p_to_location })
create function end_ride(p_ride_id uuid, p_condition text, p_to_location text default null) returns rides
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
  set status = case when p_condition = 'damaged' then 'maintenance'::bike_status else 'available'::bike_status end,
      updated_at = now()
  where id = r.bike_id;

  return r;
end $$;

-- A rider's high-priority report takes the bike out of service.
create function work_order_sets_bike_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.priority = 'P1' then
    update bikes set status = 'maintenance', updated_at = now()
    where id = new.bike_id and status = 'available';
  end if;
  return new;
end $$;

create trigger work_orders_p1_maintenance
  after insert on work_orders
  for each row execute function work_order_sets_bike_status();

-- ───────────────────────── Security rules (RLS) ─────────────────────────
alter table profiles enable row level security;
alter table stations enable row level security;
alter table bikes enable row level security;
alter table rides enable row level security;
alter table work_orders enable row level security;
alter table inventory enable row level security;
alter table alerts enable row level security;

-- profiles: you see/edit yourself; staff see everyone; admin edits anyone
create policy "profiles: read own or staff" on profiles for select
  using (id = auth.uid() or is_staff());
create policy "profiles: update own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin update" on profiles for update
  using (my_role() = 'admin');

-- stations & bikes: any signed-in user can read; staff can change
create policy "stations: read" on stations for select to authenticated using (true);
create policy "stations: staff write" on stations for all using (is_staff()) with check (is_staff());
create policy "bikes: read" on bikes for select to authenticated using (true);
create policy "bikes: staff write" on bikes for all using (is_staff()) with check (is_staff());

-- rides: riders see their own; staff see all. Writes go through start_ride/end_ride.
create policy "rides: read own or staff" on rides for select
  using (user_id = auth.uid() or is_staff());
create policy "rides: staff write" on rides for all using (is_staff()) with check (is_staff());

-- work orders: anyone signed in can report; reporters see theirs; staff see & update all
create policy "work_orders: insert" on work_orders for insert to authenticated
  with check (reporter_id = auth.uid() or is_staff());
create policy "work_orders: read own or staff" on work_orders for select
  using (reporter_id = auth.uid() or is_staff());
create policy "work_orders: staff update" on work_orders for update using (is_staff()) with check (is_staff());

-- inventory: staff only
create policy "inventory: staff" on inventory for all using (is_staff()) with check (is_staff());

-- alerts: riders can raise their own; staff see & resolve all
create policy "alerts: insert own" on alerts for insert to authenticated
  with check (user_id = auth.uid());
create policy "alerts: read own or staff" on alerts for select
  using (user_id = auth.uid() or is_staff());
create policy "alerts: staff update" on alerts for update using (is_staff()) with check (is_staff());

-- ───────────────────────── Realtime ─────────────────────────
-- Lets the web portal update live when bikes, tickets or alerts change.
alter publication supabase_realtime add table bikes, rides, work_orders, alerts;

-- ───────────────────────── Sample data ─────────────────────────
insert into stations (id, name, code, total_bays, node_id, status, status_message) values
  ('st-01', 'Main Gate Hub',    'MG-01', 15, 'ESP32 Node 01', 'optimal', null),
  ('st-02', 'Science Quad Hub', 'SQ-02', 12, 'ESP32 Node 02', 'optimal', null),
  ('st-03', 'Admin Hall Hub',   'AH-03', 10, 'ESP32 Node 03', 'optimal', null),
  ('st-04', 'Gymnasium Hub',    'GH-04', 15, 'ESP32 Node 04', 'warning', 'Bay 02 Reader Timeout');

insert into bikes (id, model, battery, range_km, station, bay, status, node_id) values
  ('BP-001', 'DYCI Campus Cruiser',  94, 42, 'Main Gate Station', 'Bay 01', 'available',   'PP-LOCK-001'),
  ('BP-008', 'DYCI Campus Cruiser',  92, 38, 'Main Gate Station', 'Bay 04', 'available',   'PP-LOCK-008'),
  ('BP-012', 'DYCI Campus Cruiser',  88, 35, 'Science Quad Hub',  'Bay 03', 'available',   'PP-LOCK-012'),
  ('BP-014', 'Campus Cruiser Gen-2', 14,  6, 'Gym Station',       'Bay 02', 'maintenance', 'PP-LOCK-014'),
  ('BP-015', 'DYCI Campus Cruiser',  76, 31, 'Admin Hall Hub',    'Bay 05', 'maintenance', 'PP-LOCK-015');

insert into work_orders (id, bike_id, station, bay, priority, issue_title, reported_by, status, assigned_tech, parts_allocated, node_id) values
  ('TKT-884', 'BP-014', 'Gym Station', 'Bay 02', 'P1', 'Brake Pad Wear & Caliper Binding', 'Gabriel Santos (Student)', 'Under Inspection', 'Kuya Noel B.', null, 'PP-LOCK-014'),
  ('TKT-881', 'BP-008', 'Campus Security Gate 1', 'Retrieved via Golf Cart', 'P2', 'Rear Tire Puncture (Schrader Valve leak)', 'Campus Security Gate 1', 'Reported / Queued', null, '26" inner tube (AV) in bin 4B', 'PP-LOCK-008'),
  ('TKT-879', 'BP-015', 'Engineering Annex Post #01', 'Post #01', 'P3', 'Chain Slip / Drivetrain Derailment', 'Prof. M. Reyes (Faculty)', 'Scheduled for Overhaul', null, null, 'PP-LOCK-015');

insert into inventory (id, name, description, stock, unit, percentage, status_tag, status_type, reorder_threshold) values
  ('inv-01', '18650 Li-ion Backup Cells', '3.7V - 4.2V for smart locks & solar relay', 14, 'units', 70, '70% Good', 'good', null),
  ('inv-02', 'Shimano B01S Disc Brake Pads', 'Campus Cruisers hydraulic braking calipers', 3, 'pairs left', 30, 'Reorder threshold: 5', 'warning', 5),
  ('inv-03', '26" Campus Inner Tubes', 'Schrader Valve 1.75 - 2.125 puncture-resistant', 12, 'units', 60, 'Healthy', 'good', null),
  ('inv-04', 'ESP32-WROOM-32 IoT Core Boards', 'Smart lock BLE & RFID campus verification', 1, 'unit left', 10, 'Immediate Restock Needed', 'critical', 3),
  ('inv-05', '12V DC Solenoid Latch Actuators', 'Docking station high-tension bike locking pin', 6, 'units', 50, 'Normal', 'normal', null),
  ('inv-06', 'A3144 Hall Effect Sensors', 'Wheel rotation cadence & station dock latch pickup', 9, 'units', 65, 'Normal', 'normal', null);

-- ───────────────────────── Making staff accounts ─────────────────────────
-- 1. Sign up normally (or Dashboard → Authentication → Add user) with a @dyci.edu.ph email.
-- 2. Then promote them here, e.g.:
--    update profiles set role = 'admin', is_verified = true where email = 'admin.mobility@dyci.edu.ph';
--    update profiles set role = 'security' where email = 'sec-guard-09@dyci.edu.ph';
--    update profiles set role = 'maintenance' where email = 'mnt-noel@dyci.edu.ph';
