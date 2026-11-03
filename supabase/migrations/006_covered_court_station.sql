-- PedalPass — one bike station at the Elida Campus Covered Court (run AFTER 005)
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this whole file → Run. Run it once.
--
-- What changes
--   • Replaces the four sample hubs with the real station: Covered Court Hub (beside Bldg. B).
--   • Moves every bike there and numbers the bays 01, 02, 03… in bike order.
-- Edit total_bays / node_id in Table Editor → stations to match the real rack and ESP32 node.

insert into stations (id, name, code, total_bays, node_id, status, status_message)
values ('st-cc', 'Covered Court Hub', 'CC-01', 10, 'ESP32 Node 01', 'optimal', null)
on conflict (id) do nothing;

update bikes b
set station = 'Covered Court Hub',
    bay = 'Bay ' || lpad(n.num::text, 2, '0'),
    updated_at = now()
from (select id, row_number() over (order by id) as num from bikes) n
where b.id = n.id;

delete from stations where id <> 'st-cc';
