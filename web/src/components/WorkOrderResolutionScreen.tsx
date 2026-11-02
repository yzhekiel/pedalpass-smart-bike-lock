import React, { useState } from 'react';
import { ScreenType, WorkOrderItem } from '../types';
import { supabase } from '../lib/supabase';

interface WorkOrderResolutionScreenProps {
  order: WorkOrderItem;
  onNavigate: (screen: ScreenType) => void;
  onResolved: () => void;
}

const CHECKS = [
  'Brake pads and caliper checked',
  'Disc rotor trued (no drag or rubbing)',
  'Tire pressure checked',
  'Drivetrain cleaned and chain lubricated',
  'Handlebars and stem bolts tight',
  'Smart lock opens and locks correctly',
];

export const WorkOrderResolutionScreen: React.FC<WorkOrderResolutionScreenProps> = ({ order, onNavigate, onResolved }) => {
  const [done, setDone] = useState<boolean[]>(CHECKS.map(() => false));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const allDone = done.every(Boolean);

  const handleSignOff = async () => {
    setSaving(true);
    setError('');
    const { error: ticketErr } = await supabase
      .from('work_orders')
      .update({ status: 'Resolved', resolved_at: new Date().toISOString(), resolution_notes: notes.trim() || null })
      .eq('id', order.id);
    if (ticketErr) {
      setError(ticketErr.message);
      setSaving(false);
      return;
    }
    // Put the bike back in service (only if it was held for maintenance)
    const { error: bikeErr } = await supabase
      .from('bikes')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('id', order.bikeId)
      .eq('status', 'maintenance');
    if (bikeErr) {
      setError(`Ticket resolved, but the bike could not be released: ${bikeErr.message}`);
      setSaving(false);
      return;
    }
    onResolved();
    onNavigate('maintenance');
  };

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[640px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container">
        {/* Top Header */}
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
              <h1 className="text-base font-bold text-on-surface">Work Order Resolution</h1>
              <p className="text-[11px] text-primary font-bold">WO #{order.id} • {order.bikeId}</p>
            </div>
          </div>
          <span className="text-xs bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full border border-primary/20">
            {order.status}
          </span>
        </header>

        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          {/* Ticket */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-primary-fixed text-on-primary-fixed px-2 py-0.5 rounded">
                {order.bikeId}
              </span>
              <span className="text-xs text-on-surface-variant">{order.station} ({order.bay})</span>
            </div>
            <h2 className="text-sm font-extrabold text-on-surface">{order.issueTitle}</h2>
            <p className="text-[11px] text-on-surface-variant">
              {order.priorityLabel} • Reported by {order.reportedBy} • {order.timestamp}
            </p>
            {order.assignedTech && <p className="text-[11px] text-on-surface-variant">Technician: {order.assignedTech}</p>}
          </section>

          {/* Mechanical Inspection Checklist */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">checklist</span>
                <h3 className="text-sm font-bold text-on-surface">Inspection Checklist</h3>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                {done.filter(Boolean).length}/{CHECKS.length} Completed
              </span>
            </div>

            <div className="space-y-2">
              {CHECKS.map((label, i) => (
                <label key={label} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-container cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={done[i]}
                    onChange={() => setDone((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-on-surface font-medium">{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Tech Log Notes */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-2">
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider block" htmlFor="notes">
              Technician Log Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was repaired or replaced?"
              className="w-full p-2.5 bg-surface border border-outline-variant rounded-xl text-xs text-on-surface"
            ></textarea>
          </section>

          {error && <p className="text-xs font-bold text-error">{error}</p>}

          <div className="space-y-2 pt-1">
            <button
              onClick={handleSignOff}
              disabled={!allDone || saving}
              className="w-full h-[52px] bg-primary text-on-primary rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:bg-primary-container active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">verified</span>
              <span>{saving ? 'Saving…' : `Sign Off & Return ${order.bikeId} to Fleet`}</span>
            </button>
            {!allDone && <p className="text-[11px] text-on-surface-variant text-center">Tick every checklist item to sign off.</p>}

            <button
              onClick={() => onNavigate('maintenance')}
              className="w-full py-2 text-xs text-on-surface-variant hover:text-on-surface text-center font-semibold"
            >
              Keep the bike locked and go back
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
