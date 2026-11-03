/**
 * Bikes — the whole fleet in one table: bike and lock ID, lock battery, status and lock state,
 * with a History button per bike (BikeHistoryScreen) and "Add bike", which saves the bike and shows its
 * new QR code to print.
 * Lock state comes from the ride status until the smart locks report it themselves: a bike out on a
 * ride is unlocked, every other bike is locked at its bay.
 */
import React, { useEffect, useState } from 'react';
import { BicycleItem } from '../types';
import { supabase } from '../lib/supabase';
import { fetchBikes, isLowBattery, loadingText, ShownStatus, shownStatus, useQuery } from '../lib/data';
import { BIKE_STATUS_LABEL } from './BikeHistoryScreen';
import { BikeQr, printCodes, toImage } from './QrCodesScreen';

const STATION = 'Covered Court Hub'; // the only station (migration 006)
/** The mobile app's scanner reads bike codes in this form (mobile/src/services/lockService.ts). */
const CODE = /^BP-\d{3}$/;

const STATUS_PILL: Record<ShownStatus, string> = {
  available: 'bg-success-container text-success',
  unavailable: 'bg-[#3a2414] text-[#fb923c]',
  in_use: 'bg-primary-light/15 text-primary-light',
  inspection: 'bg-tertiary-container text-tertiary',
  maintenance: 'bg-error-container text-error',
  locked: 'bg-surface-container-high text-on-surface-variant',
};

const STATUS_SHORT: Record<ShownStatus, string> = {
  ...BIKE_STATUS_LABEL,
  unavailable: 'Unavailable',
  inspection: 'Inspection',
  maintenance: 'Maintenance',
};

export function BikesScreen({ onHistory }: { onHistory: (bikeId: string) => void }) {
  const { data: bikes, error, reload } = useQuery(fetchBikes);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<BicycleItem | null>(null);

  if (!bikes) return <p className="px-4 lg:px-8 py-6 text-sm text-on-surface-variant">{loadingText(error)}</p>;

  return (
    <div className="px-4 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant">{bikes.length} bikes at {STATION}</p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add bike
        </button>
      </div>

      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                <th className="text-left font-semibold px-6 py-4">Bike</th>
                <th className="text-left font-semibold px-6 py-4">Battery</th>
                <th className="text-left font-semibold px-6 py-4">Status</th>
                <th className="text-left font-semibold px-6 py-4">Lock</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {bikes.map((b) => (
                <tr key={b.id} className="border-t border-outline-variant/60 hover:bg-surface-container-low">
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <p className="font-bold text-on-surface">{b.id}</p>
                    <p className="text-xs text-on-surface-variant">{b.nodeId}</p>
                  </td>
                  <td className={`px-6 py-3.5 ${isLowBattery(b) ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
                    {b.battery}%
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${STATUS_PILL[shownStatus(b)]}`} title={isLowBattery(b) ? 'Lock battery 20% or lower' : undefined}>
                      {STATUS_SHORT[shownStatus(b)]}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-on-surface-variant">{b.status === 'in_use' ? 'Unlocked' : 'Locked'}</td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => onHistory(b.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container hover:border-primary-light"
                    >
                      <span className="material-symbols-outlined text-[16px]">history</span>
                      History
                    </button>
                    <button
                      onClick={() => setRemoving(b)}
                      disabled={b.status === 'in_use'}
                      title={b.status === 'in_use' ? 'Out on a ride — remove it after it is returned' : `Remove ${b.id}`}
                      className="ml-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-outline-variant text-xs font-semibold text-error hover:bg-error-container hover:border-error disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-outline-variant"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {bikes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant">
                    No bikes yet. Click Add bike to add the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {adding && (
        <AddBike
          existing={bikes}
          onClose={() => setAdding(false)}
          onAdded={reload}
        />
      )}

      {removing && <RemoveBike bike={removing} onClose={() => setRemoving(null)} onRemoved={reload} />}
    </div>
  );
}

/**
 * Confirm removal. The database decides (remove_bike, migration 011): a never-used bike is deleted,
 * a bike with rides or reports is retired so its history stays. Either way its QR code stops working.
 */
function RemoveBike({ bike, onClose, onRemoved }: { bike: BicycleItem; onClose: () => void; onRemoved: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'deleted' | 'retired' | null>(null);
  const [error, setError] = useState('');

  const remove = async () => {
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('remove_bike', { p_bike_id: bike.id });
    setBusy(false);
    if (err) {
      setError(err.message.includes('remove_bike') ? 'Run supabase/migrations/011_remove_bike.sql in Supabase first.' : err.message);
      return;
    }
    setResult(data as 'deleted' | 'retired');
    onRemoved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-label={`Remove ${bike.id}`}>
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        {result ? (
          <>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined fill-icon text-[28px] text-success">check_circle</span>
              <h3 className="text-lg font-semibold">{bike.id} removed</h3>
            </div>
            <p className="text-sm text-on-surface-variant">
              {result === 'deleted'
                ? `${bike.id} was never used, so it was deleted completely.`
                : `${bike.id} is no longer part of the fleet and its QR code no longer works. Its past rides and reports are kept in the Activity Log and reports.`}
            </p>
            <p className="text-sm text-on-surface-variant">Take the QR sticker off the bike.</p>
            <button onClick={onClose} className="w-full h-11 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container">
              Done
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-error-container text-error flex items-center justify-center">
                <span className="material-symbols-outlined">delete</span>
              </span>
              <div>
                <h3 className="text-lg font-semibold">Remove {bike.id}?</h3>
                <p className="text-xs text-on-surface-variant">
                  {bike.nodeId} • {bike.bay}
                </p>
              </div>
            </div>
            <ul className="text-sm text-on-surface-variant space-y-1.5 list-disc ml-5">
              <li>It disappears from the Bikes list and the mobile app.</li>
              <li>Its QR code stops working right away.</li>
              <li>If it was ever ridden or reported, its history is kept.</li>
            </ul>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-on-surface-variant">
                Type <b className="font-mono text-on-surface">{bike.id}</b> to confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value.toUpperCase())}
                placeholder={bike.id}
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm font-mono"
              />
            </label>
            {error && <p className="text-sm text-error">{error}</p>}
            <div className="flex gap-2">
              <button onClick={onClose} disabled={busy} className="flex-1 h-11 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container">
                Cancel
              </button>
              <button
                onClick={remove}
                disabled={typed.trim() !== bike.id || busy}
                className="flex-1 h-11 rounded-xl bg-error text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
              >
                {busy ? 'Removing…' : 'Remove bike'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Next unused number: BP-011, PP-LOCK-011, Bay 11. */
function suggestion(bikes: BicycleItem[]) {
  const used = bikes.map((b) => Number(b.id.match(/^BP-(\d{3})$/)?.[1] ?? 0));
  const n = String(Math.max(0, ...used) + 1).padStart(3, '0');
  return { code: `BP-${n}`, lock: `PP-LOCK-${n}`, bay: `Bay ${n.slice(1)}` };
}

/** Form → save the bike → its QR code appears, ready to download or print. */
function AddBike({ existing, onClose, onAdded }: { existing: BicycleItem[]; onClose: () => void; onAdded: () => void }) {
  const first = suggestion(existing);
  const [code, setCode] = useState(first.code);
  const [lock, setLock] = useState(first.lock);
  const [bay, setBay] = useState(first.bay);
  const [model, setModel] = useState('DYCI Campus Cruiser');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<{ row: BikeQr; image: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const id = code.trim().toUpperCase();
  const problem = !CODE.test(id)
    ? 'Use the form BP-001 (BP, a dash and 3 digits) so the app can scan it.'
    : existing.some((b) => b.id === id)
      ? `${id} already exists.`
      : !lock.trim()
        ? 'Enter the smart lock ID.'
        : !bay.trim()
          ? 'Enter the bay.'
          : '';

  const save = async () => {
    if (problem) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('bikes').insert({
      id,
      model: model.trim() || 'DYCI Campus Cruiser',
      battery: 100,
      range_km: 0,
      station: STATION,
      bay: bay.trim(),
      status: 'available',
      node_id: lock.trim(),
    });
    if (err) {
      setSaving(false);
      setError(err.code === '23505' ? `${id} already exists.` : err.message);
      return;
    }
    onAdded();
    // bike_qr_codes() creates the secret QR code for bikes that don't have one yet (migration 010)
    const { data, error: qrErr } = await supabase.rpc('bike_qr_codes');
    const row = (data as BikeQr[] | null)?.find((r) => r.bike_id === id);
    setSaving(false);
    if (qrErr || !row) {
      setError(`${id} was added, but its QR code could not be made${qrErr ? `: ${qrErr.message}` : ''}. Open QR Codes to print it.`);
      return;
    }
    setQr({ row, image: await toImage(row.payload) });
  };

  const field = 'w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !saving && onClose()} role="dialog" aria-modal="true" aria-label="Add bike">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/60">
          <h3 className="text-lg font-semibold">{qr ? `${qr.row.bike_id} added` : 'Add bike'}</h3>
          <button onClick={onClose} disabled={saving} className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {qr ? (
          <div className="p-5 space-y-4 text-center">
            <div className="bg-white rounded-2xl p-4 inline-block">
              <img src={qr.image} alt={`QR code for ${qr.row.bike_id}`} className="w-56 h-56" />
            </div>
            <p className="text-sm text-on-surface-variant">
              Print this QR code and attach it to <b className="text-on-surface">{qr.row.bike_id}</b>. Riders scan it to unlock the bike.
            </p>
            <div className="flex gap-2">
              <a
                href={qr.image}
                download={`${qr.row.bike_id}-qr-v${qr.row.version}.png`}
                className="flex-1 h-11 rounded-xl border border-outline-variant text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download
              </a>
              <button
                onClick={() => printCodes([qr.row])}
                className="flex-1 h-11 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-container"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Print
              </button>
            </div>
            <button onClick={onClose} className="text-sm text-on-surface-variant hover:text-on-surface">
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-3.5">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-on-surface-variant">Bike code (printed on the QR)</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BP-011" className={`${field} font-mono font-semibold`} autoFocus />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-on-surface-variant">Smart lock ID</span>
              <input value={lock} onChange={(e) => setLock(e.target.value.toUpperCase())} placeholder="PP-LOCK-011" className={field} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-on-surface-variant">Bay</span>
                <input value={bay} onChange={(e) => setBay(e.target.value)} placeholder="Bay 11" className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-on-surface-variant">Model</span>
                <input value={model} onChange={(e) => setModel(e.target.value)} className={field} />
              </label>
            </div>
            <p className="text-xs text-on-surface-variant">
              Station: {STATION}. The bike starts as Available with a full lock battery.
            </p>
            {(problem || error) && <p className="text-sm text-error">{error || problem}</p>}
            <button
              onClick={save}
              disabled={!!problem || saving}
              className="w-full h-11 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-container disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
              {saving ? 'Saving…' : 'Save & make QR code'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
