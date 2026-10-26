import React, { useState } from 'react';
import { ScreenType, WorkOrderItem } from '../types';
import { BICYCLES } from '../data/mockData';

interface ReportIssueScreenProps {
  onNavigate: (screen: ScreenType) => void;
  onSubmitTicket: (ticket: WorkOrderItem) => void;
}

export const ReportIssueScreen: React.FC<ReportIssueScreenProps> = ({
  onNavigate,
  onSubmitTicket,
}) => {
  const bike = BICYCLES.find((b) => b.id === 'BP-014') || BICYCLES[3];
  const [selectedComponent, setSelectedComponent] = useState('Brake Lever / Disc Squeak');
  const [severity, setSeverity] = useState<'P1' | 'P2' | 'P3'>('P1');
  const [description, setDescription] = useState(
    'Brake caliper pad is dragging against rotor; also solenoid latch pin at Gym Bay 02 showed high friction during dock insertion.'
  );
  const [isTestingLock, setIsTestingLock] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleRunSelfTest = () => {
    setIsTestingLock(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTestingLock(false);
      setTestResult('Ping response: 48ms • Solenoid resistance: 12.4Ω • Warning: Latch pin resistance elevated');
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTicket: WorkOrderItem = {
      id: `TKT-${Math.floor(100 + Math.random() * 900)}`,
      bikeId: bike.id,
      station: bike.station,
      bay: bike.bay,
      priority: severity,
      priorityLabel: severity === 'P1' ? 'High Priority (P1)' : severity === 'P2' ? 'Medium Priority (P2)' : 'Low Priority (P3)',
      issueTitle: selectedComponent,
      reportedBy: 'Gabriel Santos (Student)',
      timestamp: 'Just now',
      status: 'Reported / Queued',
      assignedTech: 'Kuya Noel B.',
      nodeId: bike.nodeId,
      caliperPhotoUrl: bike.imageUrl,
    };
    onSubmitTicket(newTicket);
    alert(`Work order ${newTicket.id} registered! Bay 02 locked via MQTT protocol. Technician Kuya Noel notified.`);
    onNavigate('maintenance');
  };

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[640px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('home')}
              aria-label="Go Back"
              className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-transform"
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <div>
              <h1 className="text-base font-bold text-on-surface">Report Issue & Maintenance</h1>
              <p className="text-[11px] text-error font-bold">Campus IoT Lockout Portal</p>
            </div>
          </div>
          <span className="text-xs bg-error/10 text-error font-bold px-2.5 py-1 rounded-full border border-error/20">
            Bay Lockout Mode
          </span>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          {/* Target Bicycle & IoT Node Card */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={bike.imageUrl}
                  alt={bike.model}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-xl object-cover border border-outline-variant/60 shadow-sm shrink-0"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold bg-error text-on-error px-2 py-0.5 rounded">
                      {bike.id}
                    </span>
                    <span className="text-xs text-on-surface-variant font-medium">
                      {bike.station} ({bike.bay})
                    </span>
                  </div>
                  <h2 className="text-base font-extrabold text-on-surface mt-0.5">{bike.model}</h2>
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-0.5">
                    <span className="flex items-center gap-1 text-error font-bold">
                      <span className="material-symbols-outlined text-[16px]">battery_alert</span>
                      {bike.battery}% (Critical)
                    </span>
                    <span>•</span>
                    <span className="font-mono text-secondary">Node: {bike.nodeId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostic Photo Preview */}
            <div className="rounded-xl overflow-hidden border border-outline-variant/40 relative">
              <img
                src={bike.imageUrl}
                alt="Misaligned Bay Camera"
                referrerPolicy="no-referrer"
                className="w-full h-32 object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded backdrop-blur-xs">
                CAM_GYM_BAY02 • Solenoid Offset: 4.2mm
              </div>
            </div>
          </section>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Component Selector */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-2.5">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                Select Defective Component
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Flat Tire',
                  'Brake Lever / Disc Squeak',
                  'Electronic Lock / Solenoid',
                  'Chain Slip',
                  'Damaged Frame',
                  'Sensor / BLE Offline',
                ].map((comp) => {
                  const isSelected = selectedComponent === comp;
                  return (
                    <button
                      key={comp}
                      type="button"
                      onClick={() => setSelectedComponent(comp)}
                      className={`p-2.5 rounded-xl text-left border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                          : 'bg-surface border-outline-variant/40 text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {comp}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Severity Level */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-2.5">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                Work Order Priority & Lockout
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSeverity('P3')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    severity === 'P3'
                      ? 'bg-primary/10 border-primary text-primary shadow-xs'
                      : 'bg-surface border-outline-variant/40 text-on-surface-variant'
                  }`}
                >
                  Low (P3)
                </button>
                <button
                  type="button"
                  onClick={() => setSeverity('P2')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    severity === 'P2'
                      ? 'bg-tertiary/10 border-tertiary text-tertiary shadow-xs'
                      : 'bg-surface border-outline-variant/40 text-on-surface-variant'
                  }`}
                >
                  Medium (P2)
                </button>
                <button
                  type="button"
                  onClick={() => setSeverity('P1')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    severity === 'P1'
                      ? 'bg-error/10 border-error text-error shadow-xs'
                      : 'bg-surface border-outline-variant/40 text-on-surface-variant'
                  }`}
                >
                  Critical (P1)
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                {severity === 'P1'
                  ? 'P1: Bay will immediately lock out subsequent students via central MQTT broker.'
                  : 'P2/P3: Bay remains conditionally available until technician dispatch.'}
              </p>
            </div>

            {/* Detailed Description */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-2">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                Detailed Diagnostics Note
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Describe observations, noises, or physical misalignment..."
              ></textarea>
            </div>

            {/* Arduino Lock Diagnostic Ping */}
            <div className="bg-surface-container-low border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">terminal</span>
                  <h3 className="text-xs font-bold text-on-surface">Arduino Lock Diagnostic Ping</h3>
                </div>
                <button
                  type="button"
                  onClick={handleRunSelfTest}
                  disabled={isTestingLock}
                  className="px-3 py-1 bg-surface-container-highest text-primary font-bold text-xs rounded-lg hover:bg-surface-container"
                >
                  {isTestingLock ? 'Pinging Node...' : 'Pulse Latch Test'}
                </button>
              </div>
              {testResult && (
                <div className="p-2.5 rounded-lg bg-surface font-mono text-[11px] text-primary border border-primary/20">
                  {testResult}
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <div className="space-y-2 pt-1">
              <button
                type="submit"
                className="w-full h-[52px] bg-error text-on-error rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">lock</span>
                <span>Submit Issue & Lock Bay for Maintenance</span>
              </button>

              <button
                type="button"
                onClick={() => alert('Dialing Campus Security Dispatch on Local 104...')}
                className="w-full py-2.5 text-xs text-on-surface-variant hover:text-on-surface text-center font-semibold"
              >
                Call Campus Security Dispatch (Local 104)
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
};
