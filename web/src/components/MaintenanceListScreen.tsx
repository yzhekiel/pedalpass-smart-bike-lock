/**
 * Maintenance List — the bikes that need maintenance right now: on hold (Under Inspection / Maintenance),
 * with open reports, or with a low lock battery. Most urgent first (lib/insights.ts maintenancePriority).
 * The admin contacts maintenance, then marks the reports fixed in List of Reports.
 */
import React from 'react';
import { BicycleItem } from '../types';
import { supabase } from '../lib/supabase';
import { fetchBikes, fetchWorkOrders, formatTime, isLowBattery, loadingText, ShownStatus, shownStatus, useQuery } from '../lib/data';
import { downloadCsv, isoDate } from '../lib/csv';
import { maintenancePriority } from '../lib/insights';
import { BIKE_STATUS_LABEL } from './BikeHistoryScreen';
import { PRIORITY_TONE, STEPS, Stat } from './ReportsListScreen';

const CHARGE_SOON = 30; // flag for charging; at 20% or lower a bike is Unavailable (lib/data.ts LOW_BATTERY)

const STATUS_TONE: Partial<Record<ShownStatus, string>> = {
  unavailable: 'bg-[#3a2414] text-[#fb923c]',
  inspection: 'bg-tertiary-container text-on-tertiary-container',
  maintenance: 'bg-error-container text-on-error-container',
  locked: 'bg-surface-container text-on-surface-variant',
};

async function load() {
  const [bikes, orders] = await Promise.all([fetchBikes(), fetchWorkOrders()]);
  return { bikes, orders };
}

type Props = {
  onOpenReports: (bikeId: string) => void;
  onBikeHistory: (bikeId: string) => void;
};

export function MaintenanceListScreen({ onOpenReports, onBikeHistory }: Props) {
  const { data, error, reload } = useQuery(load);

  if (!data) return <p className="p-6 text-sm text-on-surface-variant">{loadingText(error)}</p>;

  const open = data.orders.filter((o) => o.status !== 'Resolved');
  const score = new Map(
    maintenancePriority(
      data.bikes,
      data.orders.map((o) => ({ id: o.id, bike_id: o.bikeId, priority: o.priority, status: o.status, issue_title: o.issueTitle, created_at: o.createdAt, resolved_at: o.resolvedAt ?? null })),
      [],
    ).map((p) => [p.bikeId, p]),
  );

  const rows = data.bikes
    .map((b) => {
      const reports = open.filter((o) => o.bikeId === b.id).sort((x, y) => x.priority.localeCompare(y.priority));
      const since = reports.length ? Math.min(...reports.map((r) => Date.parse(r.createdAt))) : null;
      return { bike: b, reports, since, score: score.get(b.id)?.score ?? 0 };
    })
    .filter((r) => r.bike.status === 'inspection' || r.bike.status === 'maintenance' || r.reports.length > 0 || r.bike.battery < CHARGE_SOON)
    .sort((a, b) => b.score - a.score || (a.since ?? Infinity) - (b.since ?? Infinity));

  const onHold = data.bikes.filter((b) => b.status === 'inspection' || b.status === 'maintenance').length;

  const makeAvailable = async (bike: BicycleItem) => {
    if (!confirm(`Make ${bike.id} available to riders again?`)) return;
    const { error: err } = await supabase.from('bikes').update({ status: 'available', updated_at: new Date().toISOString() }).eq('id', bike.id);
    if (err) alert(`Could not update ${bike.id}: ${err.message}`);
    reload();
  };

  const exportCsv = () =>
    downloadCsv(
      `pedalpass-maintenance-list-${isoDate(new Date())}.csv`,
      rows.map((r) => ({
        Bike: r.bike.id,
        Status: BIKE_STATUS_LABEL[shownStatus(r.bike)],
        'Lock battery %': r.bike.battery,
        'Open reports': r.reports.length,
        Problems: r.reports.map((o) => `${o.id} (${o.priority}): ${o.issueTitle}`).join(' | '),
        'Waiting since': r.since ? formatTime(new Date(r.since).toISOString()) : '',
      })),
    );

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-4">
      <section className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-outline-variant/40">
        <Stat icon="build" tone="text-primary-light" label="Bikes needing maintenance" value={rows.length} />
        <Stat icon="block" tone="text-error" label="Out of service now" value={onHold} note="Under inspection or maintenance" />
        <Stat icon="list_alt" tone="text-tertiary" label="Open reports" value={open.length} />
        <Stat icon="battery_alert" tone="text-tertiary" label={`Lock battery under ${CHARGE_SOON}%`} value={data.bikes.filter((b) => b.battery < CHARGE_SOON).length} />
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-on-surface-variant">Most urgent first. Contact maintenance about these bikes, then mark their reports fixed.</p>
        <button onClick={exportCsv} className="px-4 py-2 rounded-full border border-outline-variant/60 bg-surface-container-lowest text-sm font-semibold hover:bg-surface-container flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export
        </button>
      </div>

      {rows.length === 0 ? (
        <section className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-10 text-center shadow-sm">
          <span className="material-symbols-outlined fill-icon text-[40px] text-success">task_alt</span>
          <p className="font-bold mt-2">Every bike is in good shape</p>
          <p className="text-sm text-on-surface-variant">No open reports, no bikes on hold and no low lock batteries.</p>
        </section>
      ) : (
        <section className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-on-surface-variant border-b border-outline-variant/40">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Bike</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">What needs fixing</th>
                  <th className="text-left font-semibold px-4 py-3">Lock battery</th>
                  <th className="text-left font-semibold px-4 py-3">Waiting since</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ bike, reports, since }) => (
                  <tr key={bike.id} className="border-t border-surface-container align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => onBikeHistory(bike.id)} className="font-mono font-bold text-primary-light hover:underline">
                        {bike.id}
                      </button>
                      <p className="text-xs text-on-surface-variant">{bike.bay}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_TONE[shownStatus(bike)] ?? 'bg-success-container text-on-success-container'}`}>
                        {BIKE_STATUS_LABEL[shownStatus(bike)]}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[260px] space-y-1.5">
                      {reports.length === 0 && (
                        <p className="text-xs text-on-surface-variant">
                          {bike.battery >= CHARGE_SOON
                            ? 'On hold with no open report — check it, then make it available'
                            : isLowBattery(bike)
                              ? 'Charge the lock battery — riders cannot borrow it until then'
                              : 'Charge the lock battery soon'}
                        </p>
                      )}
                      {reports.map((o) => (
                        <div key={o.id} className="text-xs">
                          <span className={`font-bold px-1.5 py-0.5 rounded mr-1.5 ${PRIORITY_TONE[o.priority]}`}>{o.priority}</span>
                          <span className="font-semibold text-on-surface">{o.issueTitle}</span>
                          <span className="text-on-surface-variant"> • {STEPS.find((s) => s.value === o.status)?.label ?? o.status}</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <Battery pct={bike.battery} />
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">{since ? formatTime(new Date(since).toISOString()) : '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {reports.length > 0 ? (
                        <button onClick={() => onOpenReports(bike.id)} className="px-3 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold">
                          Open reports
                        </button>
                      ) : bike.status === 'inspection' || bike.status === 'maintenance' ? (
                        <button onClick={() => makeAvailable(bike)} className="px-3 py-1.5 rounded-full border border-outline-variant text-xs font-semibold hover:bg-surface-container">
                          Make available
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

/** Lock battery bar: red at 20% or lower (Unavailable), amber under 30%, green otherwise. */
export function Battery({ pct }: { pct: number }) {
  const color = isLowBattery({ battery: pct }) ? 'bg-error' : pct < CHARGE_SOON ? 'bg-tertiary' : 'bg-success';
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-2 rounded-full bg-surface-container overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold w-9 text-right">{pct}%</span>
    </div>
  );
}
