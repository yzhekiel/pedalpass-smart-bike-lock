/**
 * Analytics — charts, comparisons and recommendations from PedalPass's own records, always compared with
 * the period before. The recommendations are fixed rules (lib/insights.ts); each one shows its numbers.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchBikes, LOW_BATTERY, ShownStatus, shownStatus } from '../lib/data';
import { downloadCsv, isoDate } from '../lib/csv';
import { buildInsights, hourLabel, Insight, issueParts, maintenancePriority, OrderRec, recurringProblems, RideRec, ridesByHour } from '../lib/insights';
import { BIKE_STATUS_LABEL } from './BikeHistoryScreen';
import { BarList, change, ColumnChart, TrendChart } from './charts';
import { BicycleItem } from '../types';

const DAY = 86400000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Range = 7 | 30 | 90;
type Group = 'day' | 'week' | 'month';

/** This period and the one right before it (same length), for every comparison. */
async function load(days: Range) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const prevSince = since.getTime() - days * DAY;
  const from = new Date(prevSince).toISOString();
  const [bikes, rides, recent, open, profiles] = await Promise.all([
    fetchBikes(),
    supabase.from('rides').select('bike_id, started_at, ended_at, duration_min, status').gte('started_at', from).order('started_at').limit(20000),
    supabase.from('work_orders').select('id, bike_id, priority, status, issue_title, created_at, resolved_at').gte('created_at', from).limit(10000),
    supabase.from('work_orders').select('id, bike_id, priority, status, issue_title, created_at, resolved_at').neq('status', 'Resolved'),
    supabase.from('profiles').select('verification_status, submitted_at, reviewed_at').eq('role', 'user'),
  ]);
  for (const r of [rides, recent, open, profiles]) if (r.error) throw r.error;
  const s = since.getTime();
  const allRides = rides.data as RideRec[];
  const allRecent = recent.data as OrderRec[];
  const orders = new Map<string, OrderRec>();
  for (const o of [...allRecent.filter((o) => Date.parse(o.created_at) >= s), ...(open.data as OrderRec[])]) orders.set(o.id, o);
  return {
    since: s,
    prevSince,
    bikes,
    rides: allRides.filter((r) => Date.parse(r.started_at) >= s),
    prevRides: allRides.filter((r) => Date.parse(r.started_at) < s),
    recentOrders: allRecent.filter((o) => Date.parse(o.created_at) >= s),
    prevOrders: allRecent.filter((o) => Date.parse(o.created_at) < s),
    orders: [...orders.values()],
    profiles: profiles.data as { verification_status: string; submitted_at: string | null; reviewed_at: string | null }[],
  };
}

/** Start of the day / Monday-week / month that `t` falls in. */
function bucketStart(t: number, group: Group): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  if (group === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (group === 'month') d.setDate(1);
  return d.getTime();
}

function bucketLabel(t: number, group: Group) {
  const d = new Date(t);
  if (group === 'month') return d.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export function AnalyticsScreen({ onOpenBike }: { onOpenBike: (bikeId: string) => void }) {
  const [days, setDays] = useState<Range>(30);
  const [group, setGroup] = useState<Group>('day');
  const [data, setData] = useState<Awaited<ReturnType<typeof load>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    load(days)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => {
    if (days === 7 && group !== 'day') setGroup('day');
    if (days === 90 && group === 'day') setGroup('week');
  }, [days, group]);

  const view = useMemo(() => {
    if (!data) return null;
    const shift = days * DAY; // moves a previous-period time onto the matching point of this period
    const between = (iso: string | null, a: number, b: number) => !!iso && Date.parse(iso) >= a && Date.parse(iso) < b;
    const now = Date.now() + 1;

    // Rides per day/week/month, with the previous period lined up underneath
    const buckets = new Map<number, { rides: number; minutes: number; prev: number }>();
    for (let t = bucketStart(data.since, group); t <= Date.now(); ) {
      buckets.set(t, { rides: 0, minutes: 0, prev: 0 });
      const d = new Date(t);
      if (group === 'day') d.setDate(d.getDate() + 1);
      else if (group === 'week') d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
      t = d.getTime();
    }
    for (const r of data.rides) {
      const b = buckets.get(bucketStart(Date.parse(r.started_at), group));
      if (b) {
        b.rides++;
        b.minutes += r.duration_min ?? 0;
      }
    }
    for (const r of data.prevRides) {
      const b = buckets.get(bucketStart(Date.parse(r.started_at) + shift, group));
      if (b) b.prev++;
    }
    const trend = [...buckets.entries()].map(([t, v]) => ({ t, label: bucketLabel(t, group), ...v }));

    const byWeekday = Array<number>(7).fill(0);
    for (const r of data.rides) byWeekday[(new Date(r.started_at).getDay() + 6) % 7]++;

    const parts = new Map<string, number>();
    for (const o of data.recentOrders) for (const p of issueParts(o.issue_title)) parts.set(p, (parts.get(p) ?? 0) + 1);

    const usage = new Map<string, { rides: number; minutes: number }>();
    for (const r of data.rides) {
      const u = usage.get(r.bike_id) ?? { rides: 0, minutes: 0 };
      u.rides++;
      u.minutes += r.duration_min ?? 0;
      usage.set(r.bike_id, u);
    }

    const pending = data.profiles.filter((p) => p.verification_status === 'pending_review');
    const oldest = pending.reduce((m, p) => Math.min(m, p.submitted_at ? Date.parse(p.submitted_at) : Date.now()), Date.now());
    const pair = (cur: number, prev: number) => ({ value: cur, delta: change(cur, prev) });

    return {
      trend,
      comparison: [
        {
          label: 'Identity requests',
          icon: 'person_add',
          ...pair(
            data.profiles.filter((p) => between(p.submitted_at, data.since, now)).length,
            data.profiles.filter((p) => between(p.submitted_at, data.prevSince, data.since)).length,
          ),
        },
        {
          label: 'Approved',
          icon: 'how_to_reg',
          ...pair(
            data.profiles.filter((p) => p.verification_status === 'approved' && between(p.reviewed_at, data.since, now)).length,
            data.profiles.filter((p) => p.verification_status === 'approved' && between(p.reviewed_at, data.prevSince, data.since)).length,
          ),
        },
        {
          label: 'Completed rides',
          icon: 'pedal_bike',
          ...pair(data.rides.filter((r) => r.status === 'Completed').length, data.prevRides.filter((r) => r.status === 'Completed').length),
        },
        {
          label: 'Rides with an issue',
          icon: 'warning',
          goodWhenDown: true,
          ...pair(data.rides.filter((r) => r.status === 'Issue Reported').length, data.prevRides.filter((r) => r.status === 'Issue Reported').length),
        },
        { label: 'Issues reported', icon: 'report_problem', goodWhenDown: true, ...pair(data.recentOrders.length, data.prevOrders.length) },
        {
          label: 'Repairs finished',
          icon: 'verified',
          ...pair(
            [...data.recentOrders, ...data.prevOrders].filter((o) => between(o.resolved_at, data.since, now)).length,
            data.prevOrders.filter((o) => between(o.resolved_at, data.prevSince, data.since)).length,
          ),
        },
      ],
      totalChange: change(data.rides.length, data.prevRides.length),
      byHour: ridesByHour(data.rides),
      byWeekday,
      parts: [...parts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      mostUsed: [...usage.entries()].sort((a, b) => b[1].rides - a[1].rides).slice(0, 8),
      priority: maintenancePriority(data.bikes, data.orders, data.rides).slice(0, 6),
      recurring: recurringProblems(data.recentOrders),
      insights: buildInsights({
        days,
        bikes: data.bikes,
        rides: data.rides,
        orders: data.orders,
        pendingApprovals: pending.length,
        oldestPendingHours: pending.length ? (Date.now() - oldest) / 3600000 : null,
        lowBattery: LOW_BATTERY,
      }),
    };
  }, [data, group, days]);

  const exportCsv = () =>
    view &&
    downloadCsv(
      `pedalpass-usage-${group}-${isoDate(new Date())}.csv`,
      view.trend.map((b) => ({
        [group === 'day' ? 'Day' : group === 'week' ? 'Week of' : 'Month']: isoDate(new Date(b.t)),
        Rides: b.rides,
        'Ride minutes': b.minutes,
        'Rides in the period before': b.prev,
      })),
    );

  const pill = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold ${on ? 'bg-surface-container-lowest text-primary-light shadow-sm' : 'text-on-surface-variant'}`;
  const groupWord = group === 'day' ? 'day' : group === 'week' ? 'week' : 'month';

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-5">
      {/* Filters — one row above every chart */}
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-surface-container p-1">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} onClick={() => setDays(d)} className={pill(days === d)}>
              Last {d} days
            </button>
          ))}
        </div>
        <div className="flex rounded-xl bg-surface-container p-1">
          {(['day', 'week', 'month'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              disabled={(days === 7 && g !== 'day') || (days === 90 && g === 'day')}
              className={`${pill(group === g)} disabled:opacity-40`}
            >
              {g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
        <span className="text-xs text-on-surface-variant">Compared with the {days} days before</span>
        <span className="flex-1" />
        <button onClick={exportCsv} disabled={!view} className="px-3 py-2 rounded-xl border border-outline-variant text-xs font-bold hover:bg-surface-container flex items-center gap-1 disabled:opacity-50">
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export usage
        </button>
      </section>

      {!data || !view ? (
        <p className="text-sm text-on-surface-variant">{error ? `Could not load: ${error}` : 'Loading…'}</p>
      ) : (
        <>
          <Recommendations insights={view.insights} />

          {/* Comparison numbers with change vs the period before */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {view.comparison.map((c) => {
              const lowerIsBetter = 'goodWhenDown' in c && c.goodWhenDown; // fewer issues is good news
              const good = c.delta && (lowerIsBetter ? !c.delta.up : c.delta.up);
              return (
                <div key={c.label} className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4">
                  <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary-light">{c.icon}</span>
                    {c.label}
                  </p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                  <p className="text-[11px] mt-0.5">
                    {c.delta ? (
                      <span className={good ? 'text-success' : 'text-error'}>
                        {c.delta.up ? '↑' : '↓'} {c.delta.text}
                      </span>
                    ) : (
                      <span className="text-outline">no change</span>
                    )}
                    <span className="text-outline"> vs before</span>
                  </p>
                </div>
              );
            })}
          </section>

          <FleetStatus bikes={data.bikes} />

          {/* Usage over time */}
          <Panel
            title={`Rides per ${groupWord}`}
            note={`${data.rides.length} rides in the last ${days} days`}
            badge={view.totalChange ? { text: `${view.totalChange.up ? '↑' : '↓'} ${view.totalChange.text} vs the ${days} days before`, good: view.totalChange.up } : undefined}
          >
            <TrendChart
              points={view.trend.map((b) => ({
                key: String(b.t),
                label: b.label,
                tip: group === 'week' ? `Week of ${b.label}` : b.label,
                value: b.rides,
                prev: b.prev,
              }))}
              everyNth={Math.max(1, Math.ceil(view.trend.length / 7))}
              currentLabel={`Last ${days} days`}
              prevLabel={`${days} days before`}
            />
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Panel title="Rides by hour of day" note="When rides start — schedule repairs and lock charging in the quiet hours">
              <ColumnChart
                items={view.byHour.slice(6, 22).map((n, i) => ({ key: String(i + 6), label: hourLabel(i + 6).replace(' ', ''), tip: hourLabel(i + 6), value: n }))}
                everyNth={2}
              />
            </Panel>
            <Panel title="Rides by day of week" note={`Which days are busiest (last ${days} days)`}>
              <ColumnChart items={view.byWeekday.map((n, i) => ({ key: WEEKDAYS[i], label: WEEKDAYS[i], tip: WEEKDAYS[i], value: n }))} />
            </Panel>
            <Panel title="Most used bikes" note="Rides and riding time — rotate heavily used bikes for check-ups">
              <BarList
                items={view.mostUsed.map(([id, u]) => ({ id, value: u.rides, valueText: `${u.rides} rides • ${(u.minutes / 60).toFixed(1)} h` }))}
                onOpen={onOpenBike}
                empty="No rides in this period."
              />
            </Panel>
            <Panel title="Problems by part" note={`What riders reported in the last ${days} days`}>
              <BarList
                items={view.parts.map(([part, n]) => ({ id: part, value: n, valueText: `${n} report${n > 1 ? 's' : ''}` }))}
                empty="No problems reported in this period."
                mono={false}
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Panel title="Maintenance priority" note="Most urgent first: open reports, repeat problems, low lock battery and heavy use">
              <BarList
                items={view.priority.map((p, i) => ({ id: p.bikeId, value: p.score, valueText: `#${i + 1}`, note: p.reasons.join(', ') }))}
                onOpen={onOpenBike}
                empty="No bike needs attention."
              />
            </Panel>
            <Panel title="Recurring problems" note={`3+ reports, or the same part reported twice, in ${days} days`}>
              <BarList
                items={view.recurring.map((r) => ({
                  id: r.bikeId,
                  value: r.reports,
                  valueText: `${r.reports} report${r.reports > 1 ? 's' : ''}`,
                  note: r.partCount >= 2 ? `${r.partCount}× ${r.part}` : undefined,
                }))}
                onOpen={onOpenBike}
                empty="No bike keeps having the same problem."
              />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

const INSIGHT_STYLE: Record<Insight['tone'], { icon: string; tone: string }> = {
  urgent: { icon: 'priority_high', tone: 'border-error/50 bg-error-container/40' },
  warn: { icon: 'warning', tone: 'border-tertiary/50 bg-tertiary-container/40' },
  info: { icon: 'lightbulb', tone: 'border-outline-variant/60 bg-surface-container-low' },
};

function Recommendations({ insights }: { insights: Insight[] }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-primary-light/15 text-primary-light flex items-center justify-center">
          <span className="material-symbols-outlined text-[18px]">smart_toy</span>
        </span>
        <h2 className="text-base font-semibold">Recommendations</h2>
        <span className="text-xs text-on-surface-variant">From your rides, reports and approvals</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {insights.map((i) => (
          <div key={i.title} className={`border rounded-xl p-3.5 ${INSIGHT_STYLE[i.tone].tone}`}>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">{INSIGHT_STYLE[i.tone].icon}</span>
              {i.title}
            </p>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{i.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// Bike states (not categories): each wears a status color plus its label and count, never color alone.
export const STATUS_ORDER: ShownStatus[] = ['available', 'unavailable', 'in_use', 'inspection', 'maintenance', 'locked'];
export const STATUS_FILL: Record<ShownStatus, string> = {
  available: '#4ade80',
  unavailable: '#fb923c', // low lock battery
  in_use: '#7f9cf3',
  inspection: '#f5b82e',
  maintenance: '#ff6b6b',
  locked: '#8a8a96',
};

function FleetStatus({ bikes }: { bikes: BicycleItem[] }) {
  const counts = STATUS_ORDER.map((s) => ({ s, n: bikes.filter((b) => shownStatus(b) === s).length })).filter((c) => c.n > 0);
  const total = bikes.length || 1;
  return (
    <Panel title="Fleet status right now" note={`${bikes.length} bikes`}>
      <div className="flex h-9 gap-[3px] rounded-lg overflow-hidden" role="img" aria-label={counts.map((c) => `${BIKE_STATUS_LABEL[c.s]} ${c.n}`).join(', ')}>
        {counts.map((c) => (
          <div
            key={c.s}
            title={`${BIKE_STATUS_LABEL[c.s]}: ${c.n} (${Math.round((c.n / total) * 100)}%)`}
            style={{ width: `${(c.n / total) * 100}%`, background: STATUS_FILL[c.s] }}
            className="flex items-center justify-center text-xs font-bold text-[#111114] hover:opacity-85 min-w-[18px]"
          >
            {c.n / total >= 0.06 ? c.n : ''}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {counts.map((c) => (
          <span key={c.s} className="text-sm flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_FILL[c.s] }} />
            {BIKE_STATUS_LABEL[c.s]} <b>{c.n}</b>
            <span className="text-on-surface-variant">({Math.round((c.n / total) * 100)}%)</span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

function Panel({ title, note, badge, children }: { title: string; note?: string; badge?: { text: string; good: boolean }; children: React.ReactNode }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {note && <p className="text-xs text-on-surface-variant mt-0.5">{note}</p>}
        </div>
        {badge && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${badge.good ? 'bg-success-container text-success' : 'bg-error-container text-error'}`}>{badge.text}</span>
        )}
      </div>
      {children}
    </section>
  );
}
