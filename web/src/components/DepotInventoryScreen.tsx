import React from 'react';
import { ScreenType } from '../types';
import { supabase } from '../lib/supabase';
import { fetchBikes, fetchInventory, loadingText, useQuery } from '../lib/data';

interface DepotInventoryScreenProps {
  onNavigate: (screen: ScreenType) => void;
}

async function load() {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [items, bikes, tickets] = await Promise.all([
    fetchInventory(),
    fetchBikes(),
    supabase.from('work_orders').select('issue_title, status, created_at, resolved_at').gte('created_at', since),
  ]);
  if (tickets.error) throw tickets.error;
  return { items, bikes, tickets: tickets.data };
}

const formatDuration = (ms: number) => {
  const mins = Math.round(ms / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export const DepotInventoryScreen: React.FC<DepotInventoryScreenProps> = ({ onNavigate }) => {
  const { data, error } = useQuery(load);

  const open = data?.tickets.filter((t) => t.status !== 'Resolved').length ?? 0;
  const resolved = data?.tickets.filter((t) => t.resolved_at) ?? [];
  const avgMs = resolved.length
    ? resolved.reduce((sum, t) => sum + (Date.parse(t.resolved_at!) - Date.parse(t.created_at)), 0) / resolved.length
    : null;
  const healthy = data ? data.bikes.filter((b) => b.status !== 'maintenance').length : 0;
  const health = data && data.bikes.length ? Math.round((healthy / data.bikes.length) * 1000) / 10 : null;

  // Most common issue types in the last 30 days
  const counts = new Map<string, number>();
  for (const t of data?.tickets ?? []) {
    const type = t.issue_title.split(' — ')[0];
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const failures = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalTickets = data?.tickets.length ?? 0;

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[720px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container relative">
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('maintenance')}
              aria-label="Go Back"
              className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-transform"
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <div>
              <h1 className="text-base font-bold text-on-surface">Depot Inventory & Parts</h1>
              <p className="text-[11px] text-primary font-bold">Spare parts stock</p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          {!data ? (
            <p className="text-xs text-on-surface-variant">{loadingText(error)}</p>
          ) : (
            <>
              <section className="grid grid-cols-3 gap-2.5">
                <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
                  <span className="text-[11px] text-on-surface-variant block">Fleet Health</span>
                  <div className="text-2xl font-extrabold text-primary">{health === null ? '—' : `${health}%`}</div>
                  <span className="text-[10px] text-on-surface-variant block mt-0.5">Bikes not in repair</span>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
                  <span className="text-[11px] text-on-surface-variant block">Open Work Orders</span>
                  <div className="text-2xl font-extrabold text-tertiary">{open}</div>
                  <span className="text-[10px] text-on-surface-variant block mt-0.5">Last 30 days</span>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
                  <span className="text-[11px] text-on-surface-variant block">Avg Turnaround</span>
                  <div className="text-2xl font-extrabold text-on-surface">{avgMs === null ? '—' : formatDuration(avgMs)}</div>
                  <span className="text-[10px] text-on-surface-variant block mt-0.5">Report to resolved</span>
                </div>
              </section>

              <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-surface-container pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">category</span>
                    <h2 className="text-sm font-bold text-on-surface">Hardware & Components Stock</h2>
                  </div>
                  <span className="text-xs text-on-surface-variant font-mono">{data.items.length} SKUs</span>
                </div>

                {data.items.length === 0 && <p className="text-xs text-on-surface-variant">No parts yet. Add rows to the inventory table in Supabase.</p>}

                <div className="space-y-3">
                  {data.items.map((item) => {
                    const isCritical = item.statusType === 'critical';
                    const isWarning = item.statusType === 'warning';
                    return (
                      <div key={item.id} className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-bold text-on-surface">{item.name}</h3>
                              {item.statusTag && (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isCritical ? 'bg-error text-on-error' : isWarning ? 'bg-tertiary text-on-tertiary' : 'bg-primary/10 text-primary'
                                  }`}
                                >
                                  {item.statusTag}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-on-surface-variant">{item.description}</p>
                          </div>
                          <span className="text-base font-extrabold text-on-surface shrink-0">
                            {item.stock} <span className="text-[10px] font-normal text-on-surface-variant">{item.unit}</span>
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div
                            style={{ width: `${item.percentage}%` }}
                            className={`h-full rounded-full ${isCritical ? 'bg-error' : isWarning ? 'bg-tertiary' : 'bg-primary'}`}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Top Reported Issues (Past 30 Days)</h3>
                {failures.length === 0 && <p className="text-xs text-on-surface-variant">No work orders in the last 30 days.</p>}
                <div className="space-y-2 text-xs">
                  {failures.map(([type, n]) => {
                    const share = Math.round((n / totalTickets) * 100);
                    return (
                      <div key={type}>
                        <div className="flex justify-between text-on-surface font-semibold mb-1">
                          <span>{type}</span>
                          <span className="text-primary font-bold">{n} ({share}%)</span>
                        </div>
                        <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                          <div style={{ width: `${share}%` }} className="h-full bg-primary rounded-full"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
