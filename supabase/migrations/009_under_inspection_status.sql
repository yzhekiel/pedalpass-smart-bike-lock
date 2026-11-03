-- PedalPass — new bike status "Under Inspection" (run AFTER 008, and BEFORE 010)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Run it once.
--
-- Postgres can only use a new status value after the query that adds it has finished,
-- so this is its own file. 010 uses it.
--
-- Bike statuses after this:
--   available    can be borrowed
--   in_use       someone is riding it
--   inspection   an issue was reported; maintenance must check it before it can be borrowed again
--   maintenance  out of service for repair (unsafe report, or scheduled for overhaul)
--   locked       held by an admin

alter type bike_status add value if not exists 'inspection';
