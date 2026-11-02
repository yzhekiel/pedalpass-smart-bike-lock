import React, { useState } from 'react';
import { ScreenType } from '../types';
import { StaffProfile } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { fetchBikes, loadingText, useQuery } from '../lib/data';

interface ReportIssueScreenProps {
  profile: StaffProfile;
  onNavigate: (screen: ScreenType) => void;
  onSubmitted: () => void;
}

const COMPONENTS = [
  'Flat Tire',
  'Brake Lever / Disc Squeak',
  'Electronic Lock / Solenoid',
  'Chain Slip',
  'Damaged Frame',
  'Sensor / BLE Offline',
];

const ROLE_NAME = { admin: 'Administrator', security: 'Security', maintenance: 'Maintenance' } as const;

export const ReportIssueScreen: React.FC<ReportIssueScreenProps> = ({ profile, onNavigate, onSubmitted }) => {
  const { data: bikes, error: loadError } = useQuery(fetchBikes);
  const [bikeId, setBikeId] = useState('');
  const [selectedComponent, setSelectedComponent] = useState(COMPONENTS[0]);
  const [severity, setSeverity] = useState<'P1' | 'P2' | 'P3'>('P2');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const bike = bikes?.find((b) => b.id === bikeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bike) {
      setError('Choose the bicycle first.');
      return;
    }
    setSaving(true);
    setError('');
    // The database gives the ticket number; a P1 ticket takes the bike out of service
    const { error: err } = await supabase.from('work_orders').insert({
      bike_id: bike.id,
      station: bike.station,
      bay: bike.bay,
      priority: severity,
      issue_title: description.trim() ? `${selectedComponent} — ${description.trim()}` : selectedComponent,
      reported_by: `${profile.name} (${ROLE_NAME[profile.role]})`,
      reporter_id: profile.id,
      node_id: bike.nodeId,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSubmitted();
  };

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[640px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container">
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-base font-bold text-on-surface">Report Issue & Maintenance</h1>
            <p className="text-[11px] text-error font-bold">Creates a work order for the maintenance team</p>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Bicycle */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-2.5">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">Which bicycle?</label>
              {!bikes ? (
                <p className="text-xs text-on-surface-variant">{loadingText(loadError)}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {bikes.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBikeId(b.id)}
                      className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold ${
                        bikeId === b.id
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-surface border-outline-variant/40 text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {b.id}
                    </button>
                  ))}
                </div>
              )}
              {bike && (
                <p className="text-[11px] text-on-surface-variant">
                  {bike.model} • {bike.station} ({bike.bay}) • Battery {bike.battery}% • Node {bike.nodeId}
                </p>
              )}
            </div>

            {/* Component Selector */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-2.5">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                Select Defective Component
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COMPONENTS.map((comp) => (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => setSelectedComponent(comp)}
                    className={`p-2.5 rounded-xl text-left border text-xs font-semibold transition-all ${
                      selectedComponent === comp
                        ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                        : 'bg-surface border-outline-variant/40 text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {comp}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Level */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-2.5">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">Priority</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['P3', 'Low (P3)', 'bg-primary/10 border-primary text-primary'],
                    ['P2', 'Medium (P2)', 'bg-tertiary/10 border-tertiary text-tertiary'],
                    ['P1', 'Critical (P1)', 'bg-error/10 border-error text-error'],
                  ] as const
                ).map(([value, label, active]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSeverity(value)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      severity === value ? active : 'bg-surface border-outline-variant/40 text-on-surface-variant'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-on-surface-variant">
                {severity === 'P1'
                  ? 'P1: the bicycle is taken out of service right away, so riders cannot unlock it.'
                  : 'P2/P3: the bicycle stays available until a technician checks it.'}
              </p>
            </div>

            {/* Detailed Description */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-2">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider block" htmlFor="desc">
                Notes
              </label>
              <textarea
                id="desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Describe what you saw (noises, damage, misalignment)..."
              ></textarea>
            </div>

            {error && <p className="text-xs font-bold text-error">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full h-[52px] bg-error text-on-error rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">report</span>
              <span>{saving ? 'Sending…' : 'Submit Work Order'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('maintenance')}
              className="w-full py-2 text-xs text-on-surface-variant hover:text-on-surface text-center font-semibold"
            >
              Cancel
            </button>
          </form>
        </main>
      </div>
    </div>
  );
};
