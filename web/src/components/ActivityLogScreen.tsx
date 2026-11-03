/**
 * Activity Log — everything that happened in PedalPass, written by the database itself
 * (supabase/migrations/010_automation_and_history.sql), so nobody can edit or remove entries.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatTime } from '../lib/data';
import { downloadCsv, isoDate } from '../lib/csv';

type LogRow = {
  id: number;
  created_at: string;
  action: string;
  status: string | null;
  bike_id: string | null;
  user_name: string | null;
  actor_name: string | null;
  details: string | null;
};

export const ACTION_LABEL: Record<string, string> = {
  ride_started: 'Ride started',
  ride_ended: 'Bike returned',
  ride_cancelled: 'Ride cancelled',
  bike_swapped: 'Bike swapped',
  issue_reported: 'Issue reported',
  maintenance_assigned: 'Assigned to staff',
  maintenance_update: 'Repair status changed',
  issue_resolved: 'Repair finished',
  parts_used: 'Parts used',
  bike_status_changed: 'Bike status changed',
  qr_regenerated: 'QR code regenerated',
  bike_removed: 'Bike removed',
  identity_pending_review: 'Identity submitted',
  identity_approved: 'Identity approved',
  identity_rejected: 'Identity rejected',
  identity_needs_documents: 'Identity reset',
};

const ACTION_ICON: Record<string, string> = {
  ride_started: 'pedal_bike',
  ride_ended: 'local_parking',
  ride_cancelled: 'cancel',
  bike_swapped: 'swap_horiz',
  issue_reported: 'report_problem',
  maintenance_assigned: 'engineering',
  maintenance_update: 'build',
  issue_resolved: 'verified',
  parts_used: 'inventory_2',
  bike_status_changed: 'sync_alt',
  qr_regenerated: 'qr_code_2',
  bike_removed: 'delete',
};

const GROUPS: Record<string, string[]> = {
  Rides: ['ride_started', 'ride_ended', 'ride_cancelled', 'bike_swapped'],
  'Reports & repairs': ['issue_reported', 'maintenance_assigned', 'maintenance_update', 'issue_resolved', 'parts_used'],
  Bikes: ['bike_status_changed', 'qr_regenerated', 'bike_removed'],
  'Identity approvals': ['identity_pending_review', 'identity_approved', 'identity_rejected', 'identity_needs_documents'],
};

export function ActivityLogScreen({ initialBikeId = '' }: { initialBikeId?: string }) {
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 7 * 86400000)));
  const [to, setTo] = useState(isoDate(new Date()));
  const [group, setGroup] = useState('');
  const [bike, setBike] = useState(initialBikeId);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError('');
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    let q = supabase
      .from('activity_log')
      .select('*')
      .gte('created_at', new Date(`${from}T00:00:00`).toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .limit(2000);
    if (group) q = q.in('action', GROUPS[group]);
    if (bike.trim()) q = q.eq('bike_id', bike.trim().toUpperCase());
    q.then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err.message);
      else setRows(data as LogRow[]);
    });
    return () => {
      cancelled = true;
    };
  }, [from, to, group, bike]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!rows || !s) return rows ?? [];
    return rows.filter((r) =>
      [r.user_name, r.actor_name, r.details, r.bike_id, r.status, ACTION_LABEL[r.action]].join(' ').toLowerCase().includes(s),
    );
  }, [rows, search]);

  const exportCsv = () =>
    downloadCsv(
      `pedalpass-activity-${from}-to-${to}.csv`,
      shown.map((r) => ({
        'Date & time': formatTime(r.created_at),
        Action: ACTION_LABEL[r.action] ?? r.action,
        Status: r.status ?? '',
        Bike: r.bike_id ?? '',
        Student: r.user_name ?? '',
        'Done by': r.actor_name ?? '',
        Details: r.details ?? '',
      })),
    );

  const field = 'px-3 py-2 rounded-xl border border-outline-variant bg-surface text-xs';

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-4">
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-3 shadow-sm flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-on-surface-variant flex flex-col gap-1">
          From
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={field} />
        </label>
        <label className="text-[11px] text-on-surface-variant flex flex-col gap-1">
          To
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
        <label className="text-[11px] text-on-surface-variant flex flex-col gap-1">
          Type
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={field}>
            <option value="">Everything</option>
            {Object.keys(GROUPS).map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-on-surface-variant flex flex-col gap-1">
          Bike
          <input value={bike} onChange={(e) => setBike(e.target.value)} placeholder="BP-001" className={`${field} w-24`} />
        </label>
        <label className="text-[11px] text-on-surface-variant flex flex-col gap-1 flex-1 min-w-[180px]">
          Search
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Student, staff, ticket, details…" className={field} />
        </label>
        <button onClick={exportCsv} className="px-3 py-2 rounded-xl border border-outline-variant text-xs font-bold hover:bg-surface-container flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export
        </button>
      </section>

      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-surface-container flex items-center justify-between">
          <h2 className="text-sm font-bold text-on-surface">Activity</h2>
          <span className="text-[11px] text-on-surface-variant">
            {error ? `Could not load: ${error}` : rows ? `${shown.length} entries${rows.length === 2000 ? ' (newest 2000 — narrow the dates)' : ''}` : 'Loading…'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-container-low text-[10px] uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="text-left px-3 py-2 font-bold">When</th>
                <th className="text-left px-3 py-2 font-bold">Action</th>
                <th className="text-left px-3 py-2 font-bold">Bike</th>
                <th className="text-left px-3 py-2 font-bold">Student</th>
                <th className="text-left px-3 py-2 font-bold">Done by</th>
                <th className="text-left px-3 py-2 font-bold">Status</th>
                <th className="text-left px-3 py-2 font-bold">Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-surface-container align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-on-surface-variant">{formatTime(r.created_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-bold">
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-primary-light">{ACTION_ICON[r.action] ?? 'how_to_reg'}</span>
                      {ACTION_LABEL[r.action] ?? r.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono font-bold text-primary-light">{r.bike_id ?? '—'}</td>
                  <td className="px-3 py-2">{r.user_name ?? '—'}</td>
                  <td className="px-3 py-2">{r.actor_name ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.status ?? ''}</td>
                  <td className="px-3 py-2 text-on-surface-variant min-w-[220px]">{r.details ?? ''}</td>
                </tr>
              ))}
              {rows && shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-on-surface-variant">
                    Nothing happened in this period with these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
