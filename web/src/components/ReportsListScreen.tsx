/**
 * List of Reports — every issue report in one list (open and fixed).
 * Flow: the admin contacts maintenance outside the app, sets the report to "Sent to maintenance", and when
 * maintenance says it's fixed, uses "Mark as fixed". Bike statuses follow automatically (migration 010).
 */
import React, { useMemo, useState } from 'react';
import { ScreenType, WorkOrderItem } from '../types';
import { supabase } from '../lib/supabase';
import { fetchWorkOrders, formatTime, loadingText, useQuery } from '../lib/data';
import { downloadCsv, isoDate } from '../lib/csv';

type Props = {
  onNavigate: (screen: ScreenType) => void;
  onOpen: (order: WorkOrderItem) => void;
  onBikeHistory: (bikeId: string) => void;
  /** Pre-filled search, e.g. a bike ID from the Maintenance List */
  initialSearch?: string;
};

/**
 * Steps an admin can pick here (database value → what it means in the admin → maintenance flow).
 * "Resolved" is set by Mark as Fixed.
 */
export const STEPS: { value: WorkOrderItem['status']; label: string }[] = [
  { value: 'Reported / Queued', label: 'New — maintenance not contacted yet' },
  { value: 'Under Inspection', label: 'Sent to maintenance' },
  { value: 'Scheduled for Overhaul', label: 'Big repair — bike out of service' },
];
export const PRIORITY_TONE = { P1: 'bg-error/10 text-error', P2: 'bg-tertiary/10 text-tertiary', P3: 'bg-primary-light/10 text-primary-light' };

const hours = (ms: number) => (ms < 3600000 ? `${Math.round(ms / 60000)}m` : `${(ms / 3600000).toFixed(1)}h`);

export function ReportsListScreen({ onNavigate, onOpen, onBikeHistory, initialSearch = '' }: Props) {
  const { data: orders, error, reload } = useQuery(() => fetchWorkOrders());
  const [tab, setTab] = useState<'open' | 'resolved' | 'all'>('open');
  const [priority, setPriority] = useState<'all' | WorkOrderItem['priority']>('all');
  const [search, setSearch] = useState(initialSearch);
  const [saving, setSaving] = useState('');

  const list = useMemo(() => {
    if (!orders) return [];
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => (tab === 'open' ? o.status !== 'Resolved' : tab === 'resolved' ? o.status === 'Resolved' : true))
      .filter((o) => priority === 'all' || o.priority === priority)
      .filter((o) => !q || [o.id, o.bikeId, o.issueTitle, o.reportedBy, o.assignedTech ?? ''].join(' ').toLowerCase().includes(q))
      .sort((a, b) =>
        tab === 'open' ? a.priority.localeCompare(b.priority) || b.createdAt.localeCompare(a.createdAt) : b.createdAt.localeCompare(a.createdAt),
      );
  }, [orders, tab, priority, search]);

  const setStep = async (order: WorkOrderItem, status: WorkOrderItem['status']) => {
    setSaving(order.id);
    const { error: err } = await supabase.from('work_orders').update({ status }).eq('id', order.id);
    setSaving('');
    if (err) alert(`Could not update ${order.id}: ${err.message}`);
    reload();
  };

  const exportCsv = () =>
    downloadCsv(
      `pedalpass-reports-${isoDate(new Date())}.csv`,
      list.map((o) => ({
        Ticket: o.id,
        Bike: o.bikeId,
        Priority: o.priority,
        Status: o.status === 'Resolved' ? 'Fixed' : STEPS.find((s) => s.value === o.status)?.label ?? o.status,
        Issue: o.issueTitle,
        'Reported by': o.reportedBy,
        Reported: formatTime(o.createdAt),
        'Fixed by': o.assignedTech ?? '',
        Fixed: o.resolvedAt ? formatTime(o.resolvedAt) : '',
        'What was fixed': o.resolutionNotes ?? '',
      })),
    );

  if (!orders) return <p className="p-6 text-sm text-on-surface-variant">{loadingText(error)}</p>;

  const open = orders.filter((o) => o.status !== 'Resolved');
  const weekAgo = Date.now() - 7 * 86400000;
  const fixedWeek = orders.filter((o) => o.resolvedAt && Date.parse(o.resolvedAt) > weekAgo);
  const avgFix = fixedWeek.length ? fixedWeek.reduce((s, o) => s + Date.parse(o.resolvedAt!) - Date.parse(o.createdAt), 0) / fixedWeek.length : null;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-4">
      <section className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-outline-variant/40">
        <Stat icon="list_alt" tone="text-primary-light" label="Open reports" value={open.length} />
        <Stat icon="dangerous" tone="text-error" label="Unsafe (P1) open" value={open.filter((o) => o.priority === 'P1').length} />
        <Stat icon="call" tone="text-tertiary" label="Maintenance not contacted" value={open.filter((o) => o.status === 'Reported / Queued').length} />
        <Stat icon="verified" tone="text-success" label="Fixed this week" value={fixedWeek.length} note={avgFix ? `avg ${hours(avgFix)} to fix` : undefined} />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-1">
          {(['open', 'resolved', 'all'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === t ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant'}`}
            >
              {t === 'open' ? 'Open' : t === 'resolved' ? 'Fixed' : 'All'}
            </button>
          ))}
        </div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className="px-3 py-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-sm"
        >
          <option value="all">All priorities</option>
          <option value="P1">P1 – Unsafe</option>
          <option value="P2">P2 – Medium</option>
          <option value="P3">P3 – Minor</option>
        </select>
        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-full bg-surface-container-lowest border border-outline-variant/60">
          <span className="material-symbols-outlined text-[18px] text-outline">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket, bike, issue, reporter…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button onClick={exportCsv} className="px-4 py-2 rounded-full border border-outline-variant/60 bg-surface-container-lowest text-sm font-semibold hover:bg-surface-container flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export
        </button>
      </section>

      <section className="space-y-3">
        {list.length === 0 && <p className="text-sm text-on-surface-variant py-10 text-center">No reports match these filters.</p>}
        {list.map((o) => {
          const fixed = o.status === 'Resolved';
          return (
            <article key={o.id} className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => onBikeHistory(o.bikeId)} className="text-sm font-mono font-bold text-primary-light hover:underline">
                  {o.bikeId}
                </button>
                <span className="text-xs font-mono text-on-surface-variant">{o.id}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_TONE[o.priority]}`}>{o.priorityLabel}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${fixed ? 'bg-success-container text-on-success-container' : 'bg-surface-container text-on-surface-variant'}`}>
                  {fixed ? 'Fixed' : STEPS.find((s) => s.value === o.status)?.label ?? o.status}
                </span>
                <span className="ml-auto text-xs text-outline">{formatTime(o.createdAt)}</span>
              </div>
              <h3 className="text-base font-semibold text-on-surface">{o.issueTitle}</h3>
              <p className="text-xs text-on-surface-variant">
                Reported by {o.reportedBy} • {o.station} ({o.bay})
                {fixed && o.resolvedAt && (
                  <>
                    {' '}
                    • Fixed {formatTime(o.resolvedAt)}
                    {o.assignedTech && <> by {o.assignedTech}</>}
                  </>
                )}
              </p>
              {o.resolutionNotes && <p className="text-xs text-on-surface-variant italic">“{o.resolutionNotes}”</p>}

              {!fixed && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-container">
                  <select
                    value={o.status}
                    disabled={saving === o.id}
                    onChange={(e) => setStep(o, e.target.value as WorkOrderItem['status'])}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest text-sm"
                  >
                    {STEPS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onOpen(o)}
                    className="ml-auto px-4 py-2 bg-primary text-on-primary font-semibold text-sm rounded-full hover:bg-primary-container"
                  >
                    Mark as fixed
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}

export function Stat({ icon, tone, label, value, note }: { icon: string; tone: string; label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="p-5">
      <span className={`material-symbols-outlined fill-icon text-[22px] ${tone}`}>{icon}</span>
      <p className="text-sm text-on-surface-variant mt-2">{label}</p>
      <p className="text-2xl font-bold text-on-surface">{value}</p>
      {note && <p className="text-xs text-outline">{note}</p>}
    </div>
  );
}
