import React from 'react';
import { ScreenType } from '../types';
import { StaffProfile } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { fetchBikes, fetchOpenWorkOrders, fetchStations, loadingText, useQuery } from '../lib/data';

interface AdminDashboardScreenProps {
  profile: StaffProfile;
  onNavigate: (screen: ScreenType) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 6); // 6 AM – 6 PM
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

async function load() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [bikes, stations, tickets, profiles, rides, alerts] = await Promise.all([
    fetchBikes(),
    fetchStations(),
    fetchOpenWorkOrders(),
    supabase.from('profiles').select('role, verification_status'),
    supabase.from('rides').select('started_at').gte('started_at', startOfDay.toISOString()),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('resolved', false),
  ]);
  for (const r of [profiles, rides, alerts]) if (r.error) throw r.error;

  const riders = profiles.data!.filter((p) => p.role === 'student' || p.role === 'faculty');
  const perHour = HOURS.map((h) => ({
    hour: h,
    count: rides.data!.filter((r) => new Date(r.started_at).getHours() === h).length,
  }));
  return {
    bikes,
    stations,
    tickets,
    students: riders.filter((p) => p.role === 'student').length,
    faculty: riders.filter((p) => p.role === 'faculty').length,
    approved: riders.filter((p) => p.verification_status === 'approved').length,
    ridesToday: rides.data!.length,
    perHour,
    openAlerts: alerts.count ?? 0,
  };
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ profile, onNavigate }) => {
  const { data, error } = useQuery(load);

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[720px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container">
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-sm">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-[11px] font-bold text-primary tracking-wide">OPERATIONS CONTROL</span>
              </div>
              <h1 className="text-sm font-extrabold text-on-surface">{profile.name}</h1>
              {profile.title && <p className="text-[10px] text-on-surface-variant">{profile.title}</p>}
            </div>
          </div>
          <button
            onClick={() => onNavigate('depot_inventory')}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-primary font-bold text-xs hover:bg-surface-container-high"
          >
            Parts Inventory
          </button>
        </header>

        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          {!data ? (
            <p className="text-xs text-on-surface-variant">{loadingText(error)}</p>
          ) : (
            <Overview data={data} onNavigate={onNavigate} />
          )}
        </main>
      </div>
    </div>
  );
};

function Overview({ data, onNavigate }: { data: Awaited<ReturnType<typeof load>>; onNavigate: (s: ScreenType) => void }) {
  const { bikes, stations, tickets } = data;
  const available = bikes.filter((b) => b.status === 'available').length;
  const inUse = bikes.filter((b) => b.status === 'in_use').length;
  const maint = bikes.filter((b) => b.status === 'maintenance').length;
  const users = data.students + data.faculty;
  const peak = Math.max(1, ...data.perHour.map((h) => h.count));
  const pct = (n: number) => (bikes.length ? Math.round((n / bikes.length) * 100) : 0);
  const urgent = tickets.filter((t) => t.priority === 'P1');
  const hubsDown = stations.filter((s) => s.status !== 'optimal');

  return (
    <>
      {/* Alerts */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Operational Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Card icon="warning" tone="text-tertiary" title={`${tickets.length} open tickets`} text={urgent.length ? `${urgent.length} critical (P1)` : 'None critical'}>
            <button onClick={() => onNavigate('maintenance')} className="text-[10px] text-primary font-bold hover:underline mt-1 block">
              Open the work queue
            </button>
          </Card>
          <Card
            icon="router"
            tone="text-primary"
            title={`${stations.length - hubsDown.length}/${stations.length} hubs optimal`}
            text={hubsDown.length ? hubsDown.map((s) => s.statusMessage ?? s.name).join(', ') : 'No hub warnings'}
          />
          <Card icon="sos" tone="text-error" title={`${data.openAlerts} open alerts`} text="SOS and alarms">
            <button onClick={() => onNavigate('security')} className="text-[10px] text-primary font-bold hover:underline mt-1 block">
              Fleet & Security
            </button>
          </Card>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-surface-container pb-2">
          <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Fleet & Rider Statistics</h2>
          <span className="text-[11px] text-on-surface-variant">Live</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Tile label="Registered Riders" value={users} note={`${data.approved} verified`} />
          <Tile label="Bicycles Available" value={available} tone="text-primary" note={`of ${bikes.length} total`} />
          <Tile label="In Transit" value={inUse} tone="text-tertiary" note="Out now" />
          <Tile label="Rides Today" value={data.ridesToday} note="Since midnight" />
        </div>
      </section>

      {/* Hourly chart */}
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Rides by Hour (today)</h3>
          <p className="text-[11px] text-on-surface-variant">6 AM to 6 PM, counted when the ride started</p>
        </div>
        <div className="h-36 flex items-end justify-between gap-1 pt-4 px-1 border-b border-surface-container">
          {data.perHour.map((item) => (
            <div key={item.hour} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-on-surface text-surface text-[9px] font-bold px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap shadow-sm">
                {item.count} rides
              </div>
              <div
                style={{ height: `${Math.max(2, Math.round((item.count / peak) * 100))}%` }}
                className={`w-full rounded-t-md ${item.count === peak && item.count > 0 ? 'bg-primary' : 'bg-surface-container-high group-hover:bg-primary-container'}`}
              ></div>
              <span className="text-[8px] sm:text-[9px] text-outline truncate">{hourLabel(item.hour).split(' ')[0]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
            <span className="text-on-surface-variant">Riders:</span>
            <span className="font-bold text-on-surface">
              {users ? Math.round((data.students / users) * 100) : 0}% Student • {users ? Math.round((data.faculty / users) * 100) : 0}% Faculty
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
            <span className="text-on-surface-variant">Fleet:</span>
            <span className="font-bold text-primary">
              {pct(available)}% Avail • {pct(inUse)}% In-Use • {pct(maint)}% Maint
            </span>
          </div>
        </div>
      </section>

      {/* Hubs */}
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-surface-container pb-2">
          <h3 className="text-sm font-bold text-on-surface">Campus Hub Status</h3>
          <span className="text-xs text-primary font-bold">{stations.length} Hubs</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {stations.map((s) => (
            <div key={s.id} className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-on-surface">{s.name}</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'optimal' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'}`}>
                  {s.status === 'optimal' ? 'Optimal' : s.statusMessage || (s.status === 'offline' ? 'Offline' : 'Warning')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Available: <strong className="text-primary">{s.availableBikes}</strong></span>
                <span>Free Bays: <strong className="text-on-surface">{s.freeBays}</strong></span>
                <span>Total: {s.totalBays}</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div
                  style={{ width: `${s.totalBays ? Math.round((s.availableBikes / s.totalBays) * 100) : 0}%` }}
                  className="h-full bg-primary rounded-full"
                ></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {([
          { label: 'Identity Approvals', icon: 'how_to_reg', screen: 'verifications' },
          { label: 'Fleet & Security', icon: 'shield', screen: 'security' },
          { label: 'Parts Inventory', icon: 'inventory_2', screen: 'depot_inventory' },
        ] as const).map((btn) => (
          <button
            key={btn.label}
            onClick={() => onNavigate(btn.screen)}
            className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 flex flex-col items-center gap-1 hover:bg-surface-container text-center shadow-xs"
          >
            <span className="material-symbols-outlined text-primary text-[20px]">{btn.icon}</span>
            <span className="text-[10px] font-bold text-on-surface">{btn.label}</span>
          </button>
        ))}
      </section>
    </>
  );
}

function Card({ icon, tone, title, text, children }: { icon: string; tone: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 flex items-start gap-2.5">
      <span className={`material-symbols-outlined ${tone} text-[20px] shrink-0 mt-0.5`}>{icon}</span>
      <div className="flex-1">
        <h4 className="text-xs font-bold text-on-surface">{title}</h4>
        <p className="text-[11px] text-on-surface-variant">{text}</p>
        {children}
      </div>
    </div>
  );
}

function Tile({ label, value, note, tone = 'text-on-surface' }: { label: string; value: number; note: string; tone?: string }) {
  return (
    <div className="bg-surface-container-low p-2.5 rounded-xl">
      <span className="text-[11px] text-on-surface-variant block">{label}</span>
      <span className={`text-2xl font-extrabold ${tone}`}>{value}</span>
      <span className="text-[10px] text-on-surface-variant block mt-0.5">{note}</span>
    </div>
  );
}
