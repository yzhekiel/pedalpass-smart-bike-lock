-- PedalPass — remove a bike from the fleet (run AFTER 010)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Run it once.
--
-- What changes
--   • supabase.rpc('remove_bike', { p_bike_id }) — admins only (web portal → Bikes → Remove).
--       - a bike that was never ridden or reported (e.g. added by mistake) is deleted completely;
--       - a bike with rides or reports is RETIRED instead, so its history stays: it gets retired_at,
--         is locked, disappears from the fleet lists, and its QR code stops working.
--       - a bike someone is riding can't be removed until it is returned.
--   • The removal is written to the activity log.
--   • Low battery rule is now "20% or lower = unavailable" (010 still allowed exactly 20%).

alter table bikes add column if not exists retired_at timestamptz;

-- Lowest lock battery (percent) a bike may be borrowed with: 21, so 20% or lower can't be borrowed.
-- start_ride (migration 010) refuses a bike when battery < min_ride_battery().
create or replace function min_ride_battery() returns int language sql immutable as $$ select 21 $$;

create function remove_bike(p_bike_id text) returns text
language plpgsql security definer set search_path = public as $$
declare
  b bikes;
  used boolean;
begin
  if not is_staff() then raise exception 'Only admins can remove bikes'; end if;

  select * into b from bikes where id = p_bike_id for update;
  if not found then raise exception 'Bike % not found', p_bike_id; end if;
  if b.retired_at is not null then raise exception '% was already removed', p_bike_id; end if;
  if b.status = 'in_use' then raise exception '% is out on a ride. Remove it after it is returned.', p_bike_id; end if;

  used := exists (select 1 from rides where bike_id = p_bike_id)
       or exists (select 1 from work_orders where bike_id = p_bike_id)
       or exists (select 1 from alerts where bike_id = p_bike_id);

  -- Written first: a deleted bike's log entry keeps its code in the details
  perform log_activity('bike_removed', case when used then 'retired' else 'deleted' end, p_bike_id, null,
    p_bike_id || case when used then ' retired — history kept, QR code no longer works' else ' deleted (never used)' end);

  delete from private.bike_qr where bike_id = p_bike_id; -- the printed QR stops working right away

  if used then
    update bikes set retired_at = now(), status = 'locked', updated_at = now() where id = p_bike_id;
    return 'retired';
  end if;
  delete from bikes where id = p_bike_id; -- its lock key goes with it (on delete cascade)
  return 'deleted';
end $$;

revoke execute on function remove_bike(text) from public, anon;
grant execute on function remove_bike(text) to authenticated;

-- A retired bike must never get a new QR code from the QR Codes page
create or replace function bike_qr_codes() returns table (bike_id text, payload text, version int, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_staff() then raise exception 'Only admins can view QR codes'; end if;
  insert into private.bike_qr (bike_id) select b.id from bikes b where b.retired_at is null on conflict do nothing;
  return query
    select q.bike_id, 'PEDALPASS:' || q.bike_id || ':' || q.token, q.version, q.updated_at
    from private.bike_qr q join bikes b on b.id = q.bike_id
    where b.retired_at is null
    order by q.bike_id;
end $$;

create or replace function regenerate_bike_qr(p_bike_id text) returns text
language plpgsql security definer set search_path = public as $$
declare
  payload text;
  v int;
begin
  if not is_staff() then raise exception 'Only admins can regenerate QR codes'; end if;
  if exists (select 1 from bikes where id = p_bike_id and retired_at is not null) then
    raise exception '% was removed from the fleet', p_bike_id;
  end if;
  insert into private.bike_qr as q (bike_id) values (p_bike_id)
  on conflict (bike_id) do update
    set token = encode(extensions.gen_random_bytes(9), 'hex'), version = q.version + 1, updated_at = now()
  returning 'PEDALPASS:' || q.bike_id || ':' || q.token, q.version into payload, v;
  perform log_activity('qr_regenerated', 'v' || v, p_bike_id, null, 'Old QR code no longer works');
  return payload;
end $$;
