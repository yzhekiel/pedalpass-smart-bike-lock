import React from 'react';
import { ScreenType } from '../types';
import { StaffProfile } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatTime, loadingText, useQuery } from '../lib/data';

interface SecurityScreenProps {
  profile: StaffProfile;
  onNavigate: (screen: ScreenType) => void;
}

const OVERDUE_MIN = 45; // standard campus transit limit

type ActiveRide = {
  id: string;
  bike_id: string;
  started_at: string;
  profiles: { name: string; student_id: string | null; course: string | null; section: string | null } | null;
};

type Alert = { id: string; type: string; bike_id: string | null; message: string | null; created_at: string };

async function load() {
  const [rides, alerts, maintenance, tickets] = await Promise.all([
    supabase
      .from('rides')
      .select('id, bike_id, started_at, profiles(name, student_id, course, section)')
      .eq('status', 'active')
      .order('started_at'),
    supabase.from('alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(20),
    supabase.from('bikes').select('id', { count: 'exact', head: true }).eq('status', 'maintenance'),
    supabase.from('work_orders').select('id', { count: 'exact', head: true }).neq('status', 'Resolved'),
  ]);
  for (const r of [rides, alerts, maintenance, tickets]) if (r.error) throw r.error;
  return {
    rides: rides.data as unknown as ActiveRide[],
    alerts: alerts.data as Alert[],
    maintenance: maintenance.count ?? 0,
    tickets: tickets.count ?? 0,
  };
}

const minutesSince = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));

export const SecurityScreen: React.FC<SecurityScreenProps> = ({ profile, onNavigate }) => {
  const { data, error, reload } = useQuery(load);

  const resolveAlert = async (id: string) => {
    await supabase.from('alerts').update({ resolved: true }).eq('id', id);
    reload();
  };

  const overdue = data?.rides.filter((r) => minutesSince(r.started_at) > OVERDUE_MIN) ?? [];

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[640px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container relative">
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-sm">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                <span className="text-[11px] font-bold text-primary tracking-wide">ON DUTY</span>
              </div>
              <h1 className="text-sm font-extrabold text-on-surface">{profile.name}</h1>
              {profile.title && <p className="text-[10px] text-on-surface-variant">{profile.title}</p>}
            </div>
          </div>
          <button
            onClick={reload}
            aria-label="Refresh"
            className="w-9 h-9 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </header>

        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          {!data ? (
            <p className="text-xs text-on-surface-variant">{loadingText(error)}</p>
          ) : (
            <>
              <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <Stat label="Active Rides" value={data.rides.length} icon="pedal_bike" note="Across Campus" />
                <Stat
                  label={`Overdue (>${OVERDUE_MIN}m)`}
                  value={data.rides.length ? overdue.length : 0}
                  icon="timer_off"
                  tone="text-error"
                  note={overdue[0]?.bike_id ?? 'None'}
                />
                <Stat label="Open Alerts" value={data.alerts.length} icon="notifications_active" tone="text-error" note="SOS & alarms" />
                <Stat label="In Maintenance" value={data.maintenance} icon="build" tone="text-tertiary" note={`${data.tickets} open tickets`} />
              </section>

              {/* Alerts */}
              <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 border-b border-surface-container pb-2">
                  <span className="material-symbols-outlined text-error text-[20px]">sos</span>
                  Alerts to Handle
                </h3>
                {data.alerts.length === 0 && <p className="text-xs text-on-surface-variant">No open alerts.</p>}
                {data.alerts.map((a) => (
                  <div key={a.id} className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-on-surface uppercase">
                        {a.type}
                        {a.bike_id && <> • {a.bike_id}</>}
                      </span>
                      <span className="text-[10px] text-outline">{formatTime(a.created_at)}</span>
                    </div>
                    {a.message && <p className="text-[11px] text-on-surface-variant">{a.message}</p>}
                    <button onClick={() => resolveAlert(a.id)} className="text-[11px] text-primary font-bold hover:underline">
                      Mark as handled
                    </button>
                  </div>
                ))}
              </section>

              {/* Riders on the road */}
              <section className="bg-surface-container-lowest border border-primary/50 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-surface-container pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
                    <h3 className="text-sm font-bold text-on-surface">Riders Out Now</h3>
                  </div>
                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                    {data.rides.length} active
                  </span>
                </div>
                {data.rides.length === 0 && <p className="text-xs text-on-surface-variant">No bikes are out right now.</p>}
                {data.rides.map((r) => {
                  const mins = minutesSince(r.started_at);
                  const late = mins > OVERDUE_MIN;
                  return (
                    <div key={r.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-on-surface">{r.profiles?.name ?? 'Unknown rider'}</h4>
                          {r.profiles?.student_id && (
                            <span className="text-[10px] bg-primary-fixed text-on-primary-fixed px-1.5 rounded font-mono font-bold">
                              {r.profiles.student_id}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant">
                          {[r.profiles?.course, r.profiles?.section].filter(Boolean).join(' • ')}
                        </p>
                        <p className={`text-[11px] font-semibold mt-0.5 ${late ? 'text-error' : 'text-primary'}`}>
                          Unit: {r.bike_id} • Elapsed: {mins} mins{late && ' (overdue)'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </section>

              <button
                onClick={() => onNavigate('report_issue')}
                className="w-full py-2.5 rounded-xl border border-outline-variant text-xs font-bold text-primary hover:bg-surface-container flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">report_problem</span>
                Report a bicycle problem
              </button>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

function Stat({ label, value, icon, note, tone = 'text-on-surface' }: { label: string; value: number; icon: string; note: string; tone?: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between text-on-surface-variant mb-1">
        <span className="text-[11px] font-semibold">{label}</span>
        <span className={`material-symbols-outlined text-[18px] ${tone}`}>{icon}</span>
      </div>
      <div className={`text-2xl font-extrabold ${tone}`}>{value}</div>
      <div className="text-[10px] text-on-surface-variant mt-0.5">{note}</div>
    </div>
  );
}
