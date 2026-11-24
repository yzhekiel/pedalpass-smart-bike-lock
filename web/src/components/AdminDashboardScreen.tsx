/**
 * Dashboard — the admin home page in a dark card grid: rides and ready bikes with trends, most used bikes,
 * a rides-per-day line chart, reports (open vs fixed), riders (students vs faculty/staff) and a fleet overview.
 */
import React, { useMemo } from 'react';
import { Donut, TrendChart } from './charts';
import { ScreenType } from '../types';
import { StaffProfile } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { fetchBikes, fetchWorkOrders, isReady, LOW_BATTERY, loadingText, shownStatus, useQuery } from '../lib/data';

interface AdminDashboardScreenProps {
  profile: StaffProfile;
  onNavigate: (screen: ScreenType) => void;
  onOpenBike: (bikeId: string) => void;
}

const DAY = 86400000;

async function load() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 59); // this 30 days + the 30 before, for the comparison
  const [bikes, orders, profiles, rides] = await Promise.all([
    fetchBikes(),
    fetchWorkOrders(),
    supabase.from('profiles').select('role, member_type, verification_status'),
    supabase.from('rides').select('bike_id, started_at').gte('started_at', start.toISOString()).limit(50000),
  ]);
  for (const r of [profiles, rides]) if (r.error) throw r.error;
  return {
    bikes,
    orders,
    riders: profiles.data!.filter((p) => p.role === 'user'),
    rides: rides.data!.map((r) => ({ bikeId: r.bike_id as string, t: Date.parse(r.started_at) })),
  };
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ onNavigate, onOpenBike }) => {
  const { data, error } = useQuery(load);
  if (!data) return <p className="px-4 lg:px-8 py-6 text-sm text-on-surface-variant">{loadingText(error)}</p>;
  return <Dashboard data={data} onNavigate={onNavigate} onOpenBike={onOpenBike} />;
};

function Dashboard({
  data,
  onNavigate,
  onOpenBike,
}: {
  data: Awaited<ReturnType<typeof load>>;
  onNavigate: (s: ScreenType) => void;
  onOpenBike: (id: string) => void;
}) {
  const today = new Date().setHours(0, 0, 0, 0);
  const from30 = today - 29 * DAY;
  const from60 = today - 59 * DAY;

  const v = useMemo(() => {
    const last30 = data.rides.filter((r) => r.t >= from30);
    const prev30 = data.rides.filter((r) => r.t >= from60 && r.t < from30);
    const perDay = Array.from({ length: 30 }, (_, i) => {
      const start = from30 + i * DAY;
      return { t: start, n: last30.filter((r) => r.t >= start && r.t < start + DAY).length };
    });
    const usage = new Map<string, number>();
    for (const r of last30) usage.set(r.bikeId, (usage.get(r.bikeId) ?? 0) + 1);
    const open = data.orders.filter((o) => o.status !== 'Resolved');
    const fixed30 = data.orders.filter((o) => o.resolvedAt && Date.parse(o.resolvedAt) >= from30);
    return {
      rides30: last30.length,
      change: prev30.length ? ((last30.length - prev30.length) / prev30.length) * 100 : null,
      today: last30.filter((r) => r.t >= today).length,
      perDay,
      top: [...usage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      open,
      fixed30,
    };
  }, [data, from30, from60, today]);

  const { bikes, riders } = data;
  const ready = bikes.filter(isReady).length;
  const unavailable = bikes.filter((b) => shownStatus(b) === 'unavailable').length;
  const inUse = bikes.filter((b) => b.status === 'in_use').length;
  const inspection = bikes.filter((b) => b.status === 'inspection').length;
  const maintenance = bikes.filter((b) => b.status === 'maintenance').length;
  const students = riders.filter((p) => p.member_type !== 'faculty').length;
  const faculty = riders.length - students;
  const verified = riders.filter((p) => p.verification_status === 'approved').length;

  return (
    <div className="px-4 lg:px-8 py-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
      {/* Rides */}
      <Card className="xl:col-span-4" icon="route" title="Rides (30 days)" link={{ label: 'View analytics', onClick: () => onNavigate('analytics') }}>
        <p className="text-4xl font-bold tracking-tight">{v.rides30.toLocaleString()}</p>
        <p className="text-sm mt-2 text-on-surface-variant">
          {v.change !== null && (
            <span className={`font-semibold mr-1.5 ${v.change >= 0 ? 'text-success' : 'text-error'}`}>
              <span className="material-symbols-outlined text-[16px] align-[-3px] mr-0.5">
                {v.change >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              {Math.abs(v.change).toFixed(1)}%
            </span>
          )}
          +{v.today} today
        </p>
      </Card>

      {/* Ready bikes */}
      <Card className="xl:col-span-4" icon="pedal_bike" title="Bikes ready to ride" link={{ label: 'View maintenance', onClick: () => onNavigate('maintenance_list') }}>
        <p className="text-4xl font-bold tracking-tight">
          {ready}
          <span className="text-xl text-on-surface-variant font-medium"> / {bikes.length}</span>
        </p>
        <p className="text-sm mt-2 text-on-surface-variant">
          <span className="font-semibold text-primary-light mr-1.5">{inUse} out now</span>
          {inspection + maintenance + unavailable} unavailable
        </p>
      </Card>

      {/* Most used bikes */}
      <Card className="md:col-span-2 xl:col-span-4" icon="leaderboard" title="Most used bikes">
        {v.top.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No rides in the last 30 days.</p>
        ) : (
          <ul className="space-y-3">
            {v.top.map(([id, n], i) => (
              <li key={id} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <button onClick={() => onOpenBike(id)} className="font-mono font-semibold hover:text-primary-light">
                  {id}
                </button>
                <span className="ml-auto text-sm text-on-surface-variant">{n} rides</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Rides per day */}
      <Card className="md:col-span-2 xl:col-span-8" icon="show_chart" title="Statistics" badge="Last 30 days">
        <p className="text-xs text-on-surface-variant -mt-2 mb-3">Rides started per day</p>
        <TrendChart
          points={v.perDay.map((p) => {
            const label = new Date(p.t).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
            return { key: String(p.t), label, tip: label, value: p.n };
          })}
          everyNth={6}
        />
      </Card>

      {/* Reports */}
      <Card className="xl:col-span-4" icon="list_alt" title="Reports" link={{ label: 'List of reports', onClick: () => onNavigate('maintenance') }}>
        <div className="flex items-center gap-5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 flex-1 min-w-0">
            <Mini dot="bg-tertiary" label="Open" value={v.open.length} />
            <Mini dot="bg-primary-light" label="Fixed · 30d" value={v.fixed30.length} />
            <Mini dot="bg-error" label="Unsafe" value={v.open.filter((o) => o.priority === 'P1').length} />
            <Mini dot="bg-outline" label="Not called" value={v.open.filter((o) => o.status === 'Reported / Queued').length} />
          </div>
          <Donut
            size={96}
            parts={[
              { value: v.fixed30.length, color: 'var(--color-primary-light)', label: 'Fixed' },
              { value: v.open.length, color: 'var(--color-tertiary)', label: 'Open' },
            ]}
            center={String(v.open.length)}
            caption="open"
          />
        </div>
      </Card>

      {/* Riders */}
      <Card className="xl:col-span-8" icon="group" title="Riders" link={{ label: 'Approvals', onClick: () => onNavigate('verifications') }}>
        <p className="text-xs text-on-surface-variant -mt-2 mb-4">{riders.length} registered riders</p>
        <div className="flex items-center gap-6">
          <div className="flex-1 space-y-4">
            <HBar label="Students" value={students} max={Math.max(students, faculty, 1)} color="bg-secondary" />
            <HBar label="Faculty / staff" value={faculty} max={Math.max(students, faculty, 1)} color="bg-primary-light" />
          </div>
          <div className="rounded-2xl bg-surface-container p-3 text-center">
            <Donut parts={[{ value: verified, color: 'var(--color-primary-light)', label: 'Verified' }, { value: riders.length - verified, color: 'var(--color-surface-container-highest)', label: 'Not yet' }]} center={`${riders.length ? Math.round((verified / riders.length) * 100) : 0}%`} caption="verified" size={92} />
          </div>
        </div>
      </Card>

      {/* Fleet overview */}
      <Card className="xl:col-span-4" icon="directions_bike" title="Fleet overview" link={{ label: 'Bike history', onClick: () => onNavigate('bike_history') }}>
        <dl className="space-y-3.5 text-sm">
          <Line icon="check_circle" tone="text-success" label="Available" value={ready} />
          <Line icon="pedal_bike" tone="text-primary-light" label="In use" value={inUse} />
          <Line icon="search" tone="text-tertiary" label="Under inspection" value={inspection} />
          <Line icon="build" tone="text-error" label="Under maintenance" value={maintenance} />
          <Line icon="battery_alert" tone="text-[#fb923c]" label={`Unavailable (battery ${LOW_BATTERY}% or lower)`} value={unavailable} />
        </dl>
      </Card>
    </div>
  );
}

function Card({
  className = '',
  icon,
  title,
  badge,
  link,
  children,
}: {
  className?: string;
  icon: string;
  title: string;
  badge?: string;
  link?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className={`bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 flex flex-col ${className}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-8 h-8 rounded-lg bg-primary-light/15 text-primary-light flex items-center justify-center">
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </span>
        <h3 className="text-base font-semibold">{title}</h3>
        {badge && <span className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant">{badge}</span>}
      </div>
      <div className="flex-1">{children}</div>
      {link && (
        <button onClick={link.onClick} className="mt-4 pt-3 border-t border-outline-variant/60 flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface self-stretch">
          {link.label}
          <span className="material-symbols-outlined text-[18px] text-primary-light">arrow_forward</span>
        </button>
      )}
    </section>
  );
}

function Mini({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-on-surface-variant flex items-center gap-1.5 whitespace-nowrap">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        {label}
      </p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function Line({ icon, tone, label, value }: { icon: string; tone: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`material-symbols-outlined text-[18px] ${tone}`}>{icon}</span>
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="ml-auto font-semibold">{value}</dd>
    </div>
  );
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr_40px] items-center gap-3 text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <div className="h-3 rounded-full bg-surface-container overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
