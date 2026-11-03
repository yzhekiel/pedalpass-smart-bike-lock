/**
 * Bike History — everything about one bike: who rode it, what was reported, how it was repaired,
 * and any swaps. Reads rides, work_orders and bike_swaps.
 */
import React, { useEffect, useState } from 'react';
import { BicycleItem, WorkOrderItem } from '../types';
import { supabase } from '../lib/supabase';
import { fetchBikes, fetchWorkOrders, formatTime, loadingText, ShownStatus, shownStatus, useQuery } from '../lib/data';
import { downloadCsv, isoDate } from '../lib/csv';

type RideRow = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  status: string;
  note: string | null;
  profiles: { name: string; member_type: string; student_id: string | null } | null;
};
type SwapRow = { id: number; created_at: string; old_bike_id: string; new_bike_id: string; reason: string; profiles: { name: string } | null };

/** Labels for what a bike shows as (lib/data.ts shownStatus: low lock battery → unavailable). */
export const BIKE_STATUS_LABEL: Record<ShownStatus, string> = {
  available: 'Available',
  unavailable: 'Unavailable (low battery)',
  in_use: 'In use',
  inspection: 'Under inspection',
  maintenance: 'Under maintenance',
  locked: 'Locked',
};
const STATUS_TONE: Record<ShownStatus, string> = {
  available: 'bg-success-container text-success',
  unavailable: 'bg-[#3a2414] text-[#fb923c]',
  in_use: 'bg-primary-light/15 text-primary-light',
  inspection: 'bg-tertiary-container text-tertiary',
  maintenance: 'bg-error-container text-error',
  locked: 'bg-surface-container text-outline',
};

async function loadHistory(bikeId: string) {
  const [rides, orders, swaps] = await Promise.all([
    supabase
      .from('rides')
      .select('id, user_id, started_at, ended_at, duration_min, status, note, profiles(name, member_type, student_id)')
      .eq('bike_id', bikeId)
      .order('started_at', { ascending: false })
      .limit(300),
    fetchWorkOrders(bikeId),
    supabase
      .from('bike_swaps')
      .select('id, created_at, old_bike_id, new_bike_id, reason, profiles(name)')
      .or(`old_bike_id.eq.${bikeId},new_bike_id.eq.${bikeId}`)
      .order('created_at', { ascending: false }),
  ]);
  for (const r of [rides, swaps]) if (r.error) throw r.error;
  return {
    rides: rides.data as unknown as RideRow[],
    orders,
    swaps: swaps.data as unknown as SwapRow[],
  };
}

export function BikeHistoryScreen({
  initialBikeId,
  onOpenLog,
  onBack,
}: {
  initialBikeId?: string;
  onOpenLog: (bikeId: string) => void;
  onBack: () => void;
}) {
  const { data: bikes, error: bikesError, reload: reloadBikes } = useQuery(fetchBikes);
  const [bikeId, setBikeId] = useState(initialBikeId ?? '');
  const [history, setHistory] = useState<Awaited<ReturnType<typeof loadHistory>> | null>(null);
  const [error, setError] = useState('');
  const [riderId, setRiderId] = useState<string | null>(null); // rider shown in the details window

  useEffect(() => {
    if (!bikeId && bikes?.length) setBikeId(bikes[0].id);
  }, [bikes, bikeId]);

  useEffect(() => {
    if (!bikeId) return;
    let cancelled = false;
    setHistory(null);
    setError('');
    loadHistory(bikeId)
      .then((h) => !cancelled && setHistory(h))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [bikeId]);

  if (!bikes) return <p className="p-6 text-xs text-on-surface-variant">{loadingText(bikesError)}</p>;
  const bike = bikes.find((b) => b.id === bikeId);
  const onHold = bike && (bike.status === 'inspection' || bike.status === 'maintenance');
  const openReports = history?.orders.filter((o) => o.status !== 'Resolved').length ?? 0;

  /** A bike on hold with no open report (e.g. checked and found fine) can be put back by hand. */
  const makeAvailable = async () => {
    if (!bike || !confirm(`Make ${bike.id} available to riders again?`)) return;
    const { error: err } = await supabase.from('bikes').update({ status: 'available', updated_at: new Date().toISOString() }).eq('id', bike.id);
    if (err) alert(`Could not update ${bike.id}: ${err.message}`);
    reloadBikes();
  };

  const exportCsv = () => {
    if (!history || !bike) return;
    downloadCsv(`pedalpass-${bike.id}-history-${isoDate(new Date())}.csv`, [
      ...history.rides.map((r) => ({
        Date: formatTime(r.started_at),
        Type: 'Ride',
        Who: r.profiles?.name ?? '',
        Details: `${r.duration_min ?? '?'} min • ${r.status}${r.note ? ` • ${r.note}` : ''}`,
      })),
      ...history.orders.map((o) => ({
        Date: formatTime(o.createdAt),
        Type: `Report ${o.id} (${o.priority})`,
        Who: o.reportedBy,
        Details: `${o.issueTitle} • ${o.status}${o.assignedTech ? ` • ${o.assignedTech}` : ''}${o.resolutionNotes ? ` • ${o.resolutionNotes}` : ''}`,
      })),
    ]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-4">
      {/* Bike picker */}
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-3 shadow-sm flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          All bikes
        </button>
        <select value={bikeId} onChange={(e) => setBikeId(e.target.value)} className="px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm font-bold">
          {bikes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id} — {BIKE_STATUS_LABEL[shownStatus(b)]}
            </option>
          ))}
        </select>
        {bike && (
          <>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_TONE[shownStatus(bike)]}`}>{BIKE_STATUS_LABEL[shownStatus(bike)]}</span>
            <span className="text-xs text-on-surface-variant">
              {bike.model} • {bike.station} ({bike.bay}) • lock battery {bike.battery}%
            </span>
          </>
        )}
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          {onHold && history && openReports > 0 && (
            <span className="text-[11px] text-on-surface-variant">
              {openReports} open report{openReports > 1 ? 's' : ''} — use Mark as fixed in List of Reports
            </span>
          )}
          {onHold && history && openReports === 0 && (
            <button onClick={makeAvailable} className="px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Make available
            </button>
          )}
          <button onClick={() => onOpenLog(bikeId)} className="px-3 py-2 rounded-xl border border-outline-variant text-xs font-bold hover:bg-surface-container">
            Activity log
          </button>
          <button onClick={exportCsv} disabled={!history} className="px-3 py-2 rounded-xl border border-outline-variant text-xs font-bold hover:bg-surface-container flex items-center gap-1 disabled:opacity-50">
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export
          </button>
        </div>
      </section>

      {!history ? (
        <p className="text-xs text-on-surface-variant">{error ? `Could not load: ${error}` : 'Loading…'}</p>
      ) : (
        <>
          <Summary history={history} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Reports & repairs */}
            <Panel title="Reports & repairs" icon="build" count={history.orders.length}>
              {history.orders.length === 0 && <Empty text="No issues reported for this bike." />}
              {history.orders.map((o) => (
                <Repair key={o.id} order={o} />
              ))}
            </Panel>

            {/* Rides */}
            <Panel title="Riders" icon="pedal_bike" count={history.rides.length}>
              {history.rides.length === 0 && <Empty text="Nobody has ridden this bike yet." />}
              {history.rides.map((r) => (
                <div key={r.id} className="py-2 border-t border-surface-container first:border-t-0 flex justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold">
                      {r.profiles?.name ?? 'Deleted account'}
                      {r.profiles?.student_id && <span className="font-normal text-on-surface-variant"> • {r.profiles.student_id}</span>}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      {formatTime(r.started_at)}
                      {r.ended_at ? ` → ${new Date(r.ended_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}` : ' • riding now'}
                      {r.duration_min != null && ` • ${r.duration_min} min`}
                    </p>
                    {r.note && <p className="text-[11px] text-on-surface-variant italic">{r.note}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${r.status === 'Completed' ? 'bg-primary-light/10 text-primary-light' : r.status === 'active' ? 'bg-tertiary/10 text-tertiary' : 'bg-error/10 text-error'}`}>
                      {r.status === 'active' ? 'In use' : r.status}
                    </span>
                    {r.profiles && (
                      <button
                        onClick={() => setRiderId(r.user_id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-outline-variant text-[11px] font-semibold hover:bg-surface-container hover:border-primary-light"
                      >
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        View rider
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </Panel>
          </div>

          {history.swaps.length > 0 && (
            <Panel title="Bike swaps" icon="swap_horiz" count={history.swaps.length}>
              {history.swaps.map((s) => (
                <p key={s.id} className="py-1.5 text-xs border-t border-surface-container first:border-t-0">
                  <span className="text-on-surface-variant">{formatTime(s.created_at)}</span> • <b>{s.profiles?.name ?? 'Rider'}</b> swapped{' '}
                  <b className="font-mono">{s.old_bike_id}</b> → <b className="font-mono">{s.new_bike_id}</b>: {s.reason}
                </p>
              ))}
            </Panel>
          )}
        </>
      )}
      {riderId && <RiderDetails riderId={riderId} onClose={() => setRiderId(null)} />}
    </div>
  );
}

type RiderProfile = {
  id: string;
  name: string;
  email: string;
  member_type: 'student' | 'faculty';
  student_id: string | null;
  course: string | null;
  year_level: string | null;
  section: string | null;
  department: string | null;
  verification_status: string;
  reviewed_at: string | null;
  created_at: string;
};

const VERIFICATION_LABEL: Record<string, { text: string; tone: string }> = {
  approved: { text: 'Approved', tone: 'bg-success-container text-success' },
  pending_review: { text: 'Waiting for approval', tone: 'bg-tertiary-container text-tertiary' },
  rejected: { text: 'Rejected', tone: 'bg-error-container text-error' },
  needs_documents: { text: 'Documents not sent', tone: 'bg-surface-container-high text-on-surface-variant' },
};

/** Who rode the bike: profile, identity status and their latest rides (admins can read every profile). */
function RiderDetails({ riderId, onClose }: { riderId: string; onClose: () => void }) {
  const [data, setData] = useState<{ p: RiderProfile; rides: { id: string; bike_id: string; started_at: string; duration_min: number | null; status: string }[]; total: number } | null>(null);
  const [error, setError] = useState('');
  const [idPhoto, setIdPhoto] = useState<string | null | undefined>(undefined); // undefined = loading, null = none on file
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase
        .from('profiles')
        .select('id, name, email, member_type, student_id, course, year_level, section, department, verification_status, reviewed_at, created_at')
        .eq('id', riderId)
        .single(),
      supabase
        .from('rides')
        .select('id, bike_id, started_at, duration_min, status', { count: 'exact' })
        .eq('user_id', riderId)
        .order('started_at', { ascending: false })
        .limit(5),
      // Private bucket: a 10-minute link, only admins may create it (migration 004)
      supabase.storage.from('verification').createSignedUrl(`${riderId}/id.jpg`, 600),
    ]).then(([p, r, photo]) => {
      if (p.error || r.error) setError((p.error ?? r.error)!.message);
      else setData({ p: p.data as RiderProfile, rides: r.data ?? [], total: r.count ?? 0 });
      setIdPhoto(photo.data?.signedUrl ?? null);
    });
  }, [riderId]);

  // Close with Esc (the enlarged photo first)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (zoom ? setZoom(false) : onClose());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, zoom]);

  const p = data?.p;
  const v = p ? VERIFICATION_LABEL[p.verification_status] ?? VERIFICATION_LABEL.needs_documents : null;
  const faculty = p?.member_type === 'faculty';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Rider details">
      <div className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-outline-variant/60">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-12 h-12 rounded-full bg-primary-light/20 text-primary-light flex items-center justify-center text-lg font-bold shrink-0">
              {p?.name.charAt(0).toUpperCase() ?? '…'}
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold truncate">{p?.name ?? (error ? 'Could not load rider' : 'Loading…')}</h3>
              {p && <p className="text-xs text-on-surface-variant">{faculty ? 'Faculty / staff' : 'Student'}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && <p className="p-5 text-sm text-error">{error}</p>}

        {p && v && (
          <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
            <div>
              <p className="text-sm font-semibold mb-2">{faculty ? 'ID photo' : 'School ID'}</p>
              {idPhoto ? (
                <button onClick={() => setZoom(true)} className="block w-full" aria-label="Enlarge ID photo">
                  <img src={idPhoto} alt={`ID of ${p.name}`} className="w-full max-h-56 object-contain rounded-xl bg-surface-container border border-outline-variant/60" />
                </button>
              ) : (
                <p className="text-xs text-on-surface-variant bg-surface-container rounded-xl px-3 py-4 text-center">
                  {idPhoto === undefined ? 'Loading…' : 'No ID photo on file. Riders approved before ID photos were kept have none.'}
                </p>
              )}
            </div>
            <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-2.5 text-sm">
              <dt className="text-on-surface-variant">{faculty ? 'Employee / ID No.' : 'Student No.'}</dt>
              <dd className="font-semibold font-mono">{p.student_id ?? '—'}</dd>
              <dt className="text-on-surface-variant">Email</dt>
              <dd className="break-all">
                <a href={`mailto:${p.email}`} className="text-primary-light hover:underline">
                  {p.email}
                </a>
              </dd>
              {faculty ? (
                <>
                  <dt className="text-on-surface-variant">Department</dt>
                  <dd>{p.department ?? '—'}</dd>
                </>
              ) : (
                <>
                  <dt className="text-on-surface-variant">Course</dt>
                  <dd>{p.course ?? '—'}</dd>
                  <dt className="text-on-surface-variant">Year & section</dt>
                  <dd>{[p.year_level, p.section].filter(Boolean).join(' • ') || '—'}</dd>
                </>
              )}
              <dt className="text-on-surface-variant">Identity check</dt>
              <dd>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${v.tone}`}>{v.text}</span>
                {p.reviewed_at && p.verification_status === 'approved' && <span className="text-xs text-on-surface-variant ml-2">{formatTime(p.reviewed_at)}</span>}
              </dd>
              <dt className="text-on-surface-variant">Signed up</dt>
              <dd>{formatTime(p.created_at)}</dd>
              <dt className="text-on-surface-variant">Rider ID</dt>
              <dd className="font-mono text-xs text-on-surface-variant break-all">{p.id}</dd>
            </dl>

            <div>
              <p className="text-sm font-semibold mb-2">
                Rides <span className="text-on-surface-variant font-normal">({data.total} total)</span>
              </p>
              {data.rides.length === 0 ? (
                <p className="text-xs text-on-surface-variant">No rides yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.rides.map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-xs bg-surface-container rounded-lg px-3 py-2">
                      <span>
                        <b className="font-mono">{r.bike_id}</b> <span className="text-on-surface-variant">• {formatTime(r.started_at)}</span>
                      </span>
                      <span className="text-on-surface-variant">
                        {r.status === 'active' ? 'Riding now' : `${r.duration_min ?? '?'} min • ${r.status}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
      {zoom && idPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={(e) => (e.stopPropagation(), setZoom(false))}>
          <img src={idPhoto} alt="Enlarged ID photo" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function Summary({ history }: { history: Awaited<ReturnType<typeof loadHistory>> }) {
  const done = history.rides.filter((r) => r.status !== 'active');
  const minutes = done.reduce((s, r) => s + (r.duration_min ?? 0), 0);
  const open = history.orders.filter((o) => o.status !== 'Resolved').length;
  const since = Date.now() - 30 * 86400000;
  const recentIssues = history.orders.filter((o) => Date.parse(o.createdAt) > since).length;
  const last = history.rides[0];
  return (
    <section className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
      <Tile label="Rides" value={history.rides.length} note={`${Math.round(minutes / 60)} h total`} />
      <Tile label="Riders" value={new Set(history.rides.map((r) => r.profiles?.name)).size} />
      <Tile label="Open reports" value={open} tone={open ? 'text-error' : undefined} />
      <Tile label="Reports (30 days)" value={recentIssues} tone={recentIssues >= 3 ? 'text-error' : undefined} note={recentIssues >= 3 ? 'Recurring problems' : undefined} />
      <Tile label="Last rider" value={last?.profiles?.name ?? '—'} note={last ? formatTime(last.started_at) : undefined} small />
    </section>
  );
}

function Repair({ order }: { order: WorkOrderItem }) {
  return (
    <div className="py-2 border-t border-surface-container first:border-t-0 space-y-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-mono font-bold">{order.id}</span>
        <span className="text-[10px] font-bold px-1.5 rounded bg-surface-container">{order.priority}</span>
        <span className={`text-[10px] font-bold ${order.status === 'Resolved' ? 'text-primary-light' : 'text-tertiary'}`}>{order.status}</span>
        <span className="ml-auto text-[10px] text-outline">{formatTime(order.createdAt)}</span>
      </div>
      <p className="text-xs font-bold">{order.issueTitle}</p>
      <p className="text-[11px] text-on-surface-variant">
        Reported by {order.reportedBy}
        {order.assignedTech && ` • Technician: ${order.assignedTech}`}
        {order.resolvedAt && ` • Fixed ${formatTime(order.resolvedAt)}`}
      </p>
      {order.resolutionNotes && <p className="text-[11px] text-on-surface-variant italic">“{order.resolutionNotes}”</p>}
    </div>
  );
}

function Panel({ title, icon, count, children }: { title: string; icon: string; count: number; children: React.ReactNode }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-surface-container pb-2 mb-1">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-light text-[20px]">{icon}</span>
          {title}
        </h3>
        <span className="text-[10px] font-bold bg-surface-container px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="max-h-[520px] overflow-y-auto">{children}</div>
    </section>
  );
}

function Tile({ label, value, note, tone = 'text-on-surface', small }: { label: string; value: React.ReactNode; note?: string; tone?: string; small?: boolean }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-3 shadow-sm min-w-0">
      <p className="text-[11px] text-on-surface-variant font-medium">{label}</p>
      <p className={`${small ? 'text-sm mt-1' : 'text-2xl'} font-extrabold truncate ${tone}`}>{value}</p>
      {note && <p className="text-[10px] text-outline truncate">{note}</p>}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <p className="text-xs text-on-surface-variant py-4 text-center">{text}</p>;
