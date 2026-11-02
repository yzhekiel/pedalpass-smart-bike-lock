-- PedalPass — server-issued unlock tokens + cancelling a ride whose unlock failed (run AFTER 002)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Run it once.
--
-- What changes
--   • Each bike's smart lock gets its own secret key, kept in a private schema the apps cannot read.
--   • issue_unlock_token() signs a 60-second token for the rider's active ride. The ESP32 lock
--     checks the signature with the same key (copy it when flashing the lock — see the bottom of this file).
--   • cancel_ride() undoes a ride that just started when the lock would not open.
--   • The ride functions can only be called by signed-in users.

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────── Lock keys (private) ─────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.lock_keys (
  bike_id text primary key references public.bikes (id) on delete cascade,
  secret bytea not null default extensions.gen_random_bytes(32),
  created_at timestamptz not null default now()
);
alter table private.lock_keys enable row level security; -- no policies: only the functions below can read it

insert into private.lock_keys (bike_id) select id from public.bikes;

-- ───────────────────────── Unlock token (rider) ─────────────────────────
-- supabase.rpc('issue_unlock_token', { p_ride_id }) → 'PP-LOCK-001|<ride id>|<expires unix>|<hmac-sha256 hex>'
-- The lock recomputes hmac_sha256(key, '<node id>|<ride id>|<expires>') and opens only if it matches
-- and <expires> has not passed.
create function issue_unlock_token(p_ride_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  r rides;
  b bikes;
  k bytea;
  payload text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select * into r from rides where id = p_ride_id and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'No active ride found'; end if;
  select * into b from bikes where id = r.bike_id;

  insert into private.lock_keys (bike_id) values (b.id) on conflict do nothing; -- bikes added later
  select secret into k from private.lock_keys where bike_id = b.id;

  payload := b.node_id || '|' || r.id || '|' || extract(epoch from now() + interval '60 seconds')::bigint;
  return payload || '|' || encode(hmac(convert_to(payload, 'UTF8'), k, 'sha256'), 'hex');
end $$;

-- ───────────────────────── Cancel a ride that never got going ─────────────────────────
-- supabase.rpc('cancel_ride', { p_ride_id }) — when the lock did not open right after start_ride.
create function cancel_ride(p_ride_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r rides;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select * into r from rides where id = p_ride_id and user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'No active ride found'; end if;
  if r.started_at < now() - interval '5 minutes' then
    raise exception 'This ride has already started. End it instead.';
  end if;

  delete from rides where id = r.id;
  update bikes set status = 'available', updated_at = now() where id = r.bike_id and status = 'in_use';
end $$;

-- ───────────────────────── Signed-in users only ─────────────────────────
revoke execute on function start_ride(text) from anon, public;
revoke execute on function end_ride(uuid, text, text) from anon, public;
revoke execute on function issue_unlock_token(uuid) from anon, public;
revoke execute on function cancel_ride(uuid) from anon, public;
grant execute on function start_ride(text) to authenticated;
grant execute on function end_ride(uuid, text, text) to authenticated;
grant execute on function issue_unlock_token(uuid) to authenticated;
grant execute on function cancel_ride(uuid) to authenticated;

-- ───────────────────────── Getting a lock's key (for flashing the ESP32) ─────────────────────────
-- Run in the SQL Editor (as the project owner), never from the apps:
--   select bike_id, encode(secret, 'hex') from private.lock_keys where bike_id = 'BP-001';
