/**
 * Mark as fixed — maintenance has no account: they tell the admin a bike is fixed, and the admin
 * records it here (who fixed it and what was done). Resolving the bike's last open report makes it
 * Available again automatically (migration 010).
 */
import React, { useState } from 'react';
import { ScreenType, WorkOrderItem } from '../types';
import { supabase } from '../lib/supabase';

interface WorkOrderResolutionScreenProps {
  order: WorkOrderItem;
  onNavigate: (screen: ScreenType) => void;
  onResolved: () => void;
}

export const WorkOrderResolutionScreen: React.FC<WorkOrderResolutionScreenProps> = ({ order, onNavigate, onResolved }) => {
  const [fixedBy, setFixedBy] = useState(order.assignedTech ?? '');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const markFixed = async () => {
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('work_orders')
      .update({
        status: 'Resolved',
        resolved_at: new Date().toISOString(),
        resolution_notes: notes.trim() || null,
        assigned_tech: fixedBy.trim() || null,
      })
      .eq('id', order.id);
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    // The database makes the bike Available once its last open report is resolved
    onResolved();
    onNavigate('maintenance');
  };

  const field = 'w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface';

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6 space-y-4">
      <button onClick={() => onNavigate('maintenance')} className="flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface">
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        List of Reports
      </button>

      {/* The report */}
      <section className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-5 shadow-sm space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono font-bold bg-primary-fixed text-on-primary-fixed px-2 py-0.5 rounded">{order.bikeId}</span>
          <span className="text-xs font-mono text-on-surface-variant">{order.id}</span>
          <span className="text-xs text-on-surface-variant">
            {order.station} ({order.bay})
          </span>
        </div>
        <h2 className="text-lg font-bold text-on-surface">{order.issueTitle}</h2>
        <p className="text-xs text-on-surface-variant">
          {order.priorityLabel} • Reported by {order.reportedBy} • {order.timestamp}
        </p>
      </section>

      {/* What maintenance said */}
      <section className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-base font-bold">What maintenance told you</h3>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-on-surface-variant">Fixed by</span>
          <input value={fixedBy} onChange={(e) => setFixedBy(e.target.value)} placeholder="Name of the maintenance person" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-on-surface-variant">What was fixed</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. replaced front brake pads, pumped the rear tire"
            className={field}
          ></textarea>
        </label>
        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low cursor-pointer select-none">
          <input type="checkbox" checked={confirmed} onChange={() => setConfirmed(!confirmed)} className="w-4 h-4 mt-0.5 rounded text-primary-light" />
          <span className="text-sm text-on-surface">
            Maintenance confirmed <b>{order.bikeId}</b> is fixed and safe to ride.
          </span>
        </label>
      </section>

      {error && <p className="text-sm font-bold text-error">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={markFixed}
          disabled={!confirmed || saving}
          className="flex-1 h-12 bg-primary text-on-primary rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">verified</span>
          {saving ? 'Saving…' : `Mark as Fixed — ${order.bikeId} Ready to Ride`}
        </button>
        <button onClick={() => onNavigate('maintenance')} className="h-12 px-5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container">
          Not fixed yet
        </button>
      </div>
      <p className="text-xs text-on-surface-variant">{order.bikeId} becomes Available automatically, unless it still has another open report.</p>
    </div>
  );
};
