-- PedalPass — remove the sample issue reports and make the staff portal run on real data (run AFTER 004)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Run it once.
--
-- What changes
--   • Deletes the three made-up repair tickets from schema.sql (TKT-884, TKT-881, TKT-879) and puts the
--     bikes that were held for them back in service.
--   • Bikes use the same station names as the stations table, so the portal can count bikes per hub.
--   • Work orders get a "resolution_notes" column for the technician's sign-off note.
-- The bikes, stations and parts inventory rows from schema.sql are starter data: edit them in
-- Table Editor to match your real fleet and stock.

alter table work_orders add column if not exists resolution_notes text;

delete from work_orders where id in ('TKT-884', 'TKT-881', 'TKT-879');

update bikes b set status = 'available', updated_at = now()
where b.status = 'maintenance'
  and not exists (select 1 from work_orders w where w.bike_id = b.id and w.status <> 'Resolved');

update bikes set station = 'Main Gate Hub' where station = 'Main Gate Station';
update bikes set station = 'Gymnasium Hub' where station = 'Gym Station';
