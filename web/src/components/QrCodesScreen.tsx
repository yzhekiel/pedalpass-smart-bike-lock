/**
 * QR Codes — print each bike's QR, and regenerate one that is damaged, lost or misused.
 * The QR text is PEDALPASS:<bike id>:<secret code>; start_ride only accepts a bike's current code,
 * so regenerating makes the old printed QR stop working (supabase/migrations/010_automation_and_history.sql).
 */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { formatTime, loadingText, useQuery } from '../lib/data';

export type BikeQr = { bike_id: string; payload: string; version: number; updated_at: string };

async function load(): Promise<BikeQr[]> {
  const { data, error } = await supabase.rpc('bike_qr_codes');
  if (error) throw error;
  return data as BikeQr[];
}

export const toImage = (payload: string) => QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: 'M' });

/** Opens a print-ready page with one labelled QR per bike. */
export async function printCodes(codes: BikeQr[]) {
  const images = await Promise.all(codes.map((c) => toImage(c.payload)));
  const win = window.open('', '_blank');
  if (!win) {
    alert('Allow pop-ups for this site to print the QR codes.');
    return;
  }
  const cards = codes
    .map(
      (c, i) => `<div class="card"><img src="${images[i]}" alt=""><strong>${c.bike_id}</strong><span>PedalPass • Scan to unlock • v${c.version}</span></div>`,
    )
    .join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>PedalPass QR codes</title><style>
    body{font-family:system-ui,sans-serif;margin:16px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    .card{border:1px dashed #999;border-radius:8px;padding:12px;text-align:center;break-inside:avoid}
    img{width:100%;max-width:200px}
    strong{display:block;font-size:20px;margin-top:4px}
    span{font-size:11px;color:#555}
  </style></head><body><div class="grid">${cards}</div><script>window.onload = () => print()</script></body></html>`);
  win.document.close();
}

function QrCard({ code, onRegenerate, busy }: { code: BikeQr; onRegenerate: () => void; busy: boolean }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    toImage(code.payload).then(setSrc);
  }, [code.payload]);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-3 shadow-sm flex flex-col items-center gap-2">
      <div className="bg-white rounded-xl p-2 w-full flex justify-center">
        {src ? <img src={src} alt={`QR code for ${code.bike_id}`} className="w-40 h-40" /> : <div className="w-40 h-40" />}
      </div>
      <div className="text-center">
        <p className="font-extrabold text-on-surface">{code.bike_id}</p>
        <p className="text-[11px] text-on-surface-variant">
          Version {code.version} • {formatTime(code.updated_at)}
        </p>
      </div>
      <div className="flex gap-2 w-full">
        <a
          href={src}
          download={`${code.bike_id}-qr-v${code.version}.png`}
          className="flex-1 text-center text-xs font-bold py-2 rounded-xl border border-outline-variant hover:bg-surface-container"
        >
          Download
        </a>
        <button
          onClick={onRegenerate}
          disabled={busy}
          className="flex-1 text-xs font-bold py-2 rounded-xl bg-error/10 text-error hover:bg-error/20 disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Regenerate'}
        </button>
      </div>
    </div>
  );
}

export function QrCodesScreen() {
  const { data, error, reload } = useQuery(load);
  const [busy, setBusy] = useState('');

  const regenerate = async (bikeId: string) => {
    const ok = confirm(
      `Make a new QR code for ${bikeId}?\n\nThe QR code on the bike now will stop working right away. Print the new one and attach it to the bike.`,
    );
    if (!ok) return;
    setBusy(bikeId);
    const { error: err } = await supabase.rpc('regenerate_bike_qr', { p_bike_id: bikeId });
    setBusy('');
    if (err) alert(`Could not regenerate: ${err.message}`);
    reload();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-4">
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-on-surface">Bike QR Codes</h2>
          <p className="text-[11px] text-on-surface-variant max-w-xl">
            Riders scan these to unlock a bike. If a QR code is damaged, lost or copied, regenerate it: the old one stops
            working immediately, so print and attach the new one.
          </p>
        </div>
        <button
          onClick={() => data && printCodes(data)}
          disabled={!data?.length}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">print</span>
          Print all
        </button>
      </section>

      {!data ? (
        <p className="text-xs text-on-surface-variant">{loadingText(error)}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.map((c) => (
            <QrCard key={c.bike_id} code={c} busy={busy === c.bike_id} onRegenerate={() => regenerate(c.bike_id)} />
          ))}
        </div>
      )}
    </div>
  );
}
