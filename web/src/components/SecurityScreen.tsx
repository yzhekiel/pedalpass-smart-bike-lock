import React, { useState } from 'react';
import { ScreenType } from '../types';
import { USER_PROFILES } from '../data/mockData';

interface SecurityScreenProps {
  onNavigate: (screen: ScreenType) => void;
}

export const SecurityScreen: React.FC<SecurityScreenProps> = ({ onNavigate }) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [clearedBikes, setClearedBikes] = useState<string[]>([]);
  const officer = USER_PROFILES.security;

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleApproveClearance = (bikeId: string) => {
    setClearedBikes((prev) => [...prev, bikeId]);
    triggerToast(`Officer Mendoza: Gate clearance approved for ${bikeId}. Barrier opened.`);
  };

  const handleForceLock = (bikeId: string) => {
    triggerToast(`SECURITY OVERRIDE: MQTT Force Lock token broadcast to ${bikeId}. Solenoid armed.`);
  };

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[640px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container relative">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-12 z-50 left-1/2 -translate-x-1/2 max-w-sm w-[90%] bg-surface-container-highest text-on-surface px-4 py-2.5 rounded-xl shadow-xl border border-primary text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <img
              src={officer.avatarUrl}
              alt={officer.name}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover border-2 border-primary shadow-sm"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                <span className="text-[11px] font-bold text-primary tracking-wide">SEC-104 ON DUTY</span>
              </div>
              <h1 className="text-sm font-extrabold text-on-surface">{officer.name}</h1>
              <p className="text-[10px] text-on-surface-variant">DYCI Gate 1 (Bocaue Main Access)</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => triggerToast('Emergency backup dispatched to Gate 1 Bocaue.')}
              className="px-2.5 py-1 rounded-lg bg-error text-on-error font-bold text-xs flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">local_police</span>
              <span>Dispatch</span>
            </button>
            <button
              onClick={() => alert('Campus Security logs active. All 4 gates synced.')}
              className="w-9 h-9 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          {/* Gate Access Bento Stats */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between text-on-surface-variant mb-1">
                <span className="text-[11px] font-semibold">Active Rides</span>
                <span className="material-symbols-outlined text-primary text-[18px]">pedal_bike</span>
              </div>
              <div className="text-2xl font-extrabold text-on-surface">6</div>
              <div className="text-[10px] text-primary font-bold mt-0.5">Across Campus</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between text-on-surface-variant mb-1">
                <span className="text-[11px] font-semibold">Gate Crossings</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">sensor_door</span>
              </div>
              <div className="text-2xl font-extrabold text-on-surface">84</div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">Today (Gate 1)</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between text-on-surface-variant mb-1">
                <span className="text-[11px] font-semibold">Overdue Bikes</span>
                <span className="material-symbols-outlined text-error text-[18px]">timer_off</span>
              </div>
              <div className="text-2xl font-extrabold text-error">1</div>
              <div className="text-[10px] text-error font-bold mt-0.5">BP-003 (&gt;45m)</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between text-on-surface-variant mb-1">
                <span className="text-[11px] font-semibold">Maintenance</span>
                <span className="material-symbols-outlined text-tertiary text-[18px]">build</span>
              </div>
              <div className="text-2xl font-extrabold text-tertiary">2</div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">Depot Queued</div>
            </div>
          </section>

          {/* Officer Rapid Ops Shortcuts */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Gate Rapid Operations</h2>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => onNavigate('scan')}
                className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col items-center gap-1 hover:bg-surface-container active:scale-95 transition-all text-center"
              >
                <span className="material-symbols-outlined text-primary text-[20px]">qr_code_scanner</span>
                <span className="text-[11px] font-bold text-on-surface">Scan QR</span>
              </button>

              <button
                onClick={() => triggerToast('Bay 01 Solenoid overridden & released for emergency vehicle.')}
                className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col items-center gap-1 hover:bg-surface-container active:scale-95 transition-all text-center"
              >
                <span className="material-symbols-outlined text-primary text-[20px]">lock_open</span>
                <span className="text-[11px] font-bold text-on-surface">Bay Release</span>
              </button>

              <button
                onClick={() => triggerToast('BP-003 flagged for security escort. Alert broadcasted.')}
                className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col items-center gap-1 hover:bg-surface-container active:scale-95 transition-all text-center"
              >
                <span className="material-symbols-outlined text-error text-[20px]">flag</span>
                <span className="text-[11px] font-bold text-on-surface">Flag Bike</span>
              </button>

              <button
                onClick={() => triggerToast('Campus-wide PA announcement sent: Gate 1 lane clear.')}
                className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col items-center gap-1 hover:bg-surface-container active:scale-95 transition-all text-center"
              >
                <span className="material-symbols-outlined text-secondary text-[20px]">broadcast_on_personal</span>
                <span className="text-[11px] font-bold text-on-surface">Broadcast</span>
              </button>
            </div>
          </section>

          {/* Live Active Inspection Card */}
          <section className="bg-surface-container-lowest border border-primary/50 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
                <h3 className="text-sm font-bold text-on-surface">Live Approaching Rider Clearance</h3>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                Beacon Contact: 15m
              </span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={USER_PROFILES.student.avatarUrl}
                  alt="Gabriel Santos"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl object-cover border border-outline-variant shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-on-surface">Gabriel Santos</h4>
                    <span className="text-[10px] bg-primary-fixed text-on-primary-fixed px-1.5 py-0.2 rounded font-mono font-bold">
                      22-0481
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">BSIT 3-A • College of Computer Studies</p>
                  <p className="text-[11px] text-primary font-semibold mt-0.5">
                    Unit: BP-008 (Campus Cruiser) • Elapsed: 24 mins
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => handleApproveClearance('BP-008')}
                disabled={clearedBikes.includes('BP-008')}
                className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                  clearedBikes.includes('BP-008')
                    ? 'bg-primary/20 text-primary cursor-default'
                    : 'bg-primary text-on-primary shadow-xs hover:bg-primary-container'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{clearedBikes.includes('BP-008') ? 'Cleared' : 'Approve'}</span>
              </button>

              <button
                onClick={() => onNavigate('report_issue')}
                className="py-2 px-2 rounded-xl bg-surface border border-outline-variant text-on-surface font-semibold text-xs flex items-center justify-center gap-1 hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[16px]">search</span>
                <span>Inspect</span>
              </button>

              <button
                onClick={() => handleForceLock('BP-008')}
                className="py-2 px-2 rounded-xl bg-error/10 border border-error/30 text-error font-semibold text-xs flex items-center justify-center gap-1 hover:bg-error/20"
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                <span>Force Lock</span>
              </button>
            </div>
          </section>

          {/* Security & Hardware Telemetry Feed */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">sensors</span>
                Campus Mesh Telemetry Feed
              </h3>
              <span className="text-[10px] text-on-surface-variant font-mono">MQTT: QoS 1</span>
            </div>

            <div className="space-y-2.5">
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-on-surface">BP-014 (Bay 02 - Gym Station)</span>
                  <span className="text-[10px] bg-tertiary/10 text-tertiary font-bold px-1.5 py-0.5 rounded">
                    Maint. Dispatched
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Low Battery (14%) & BLE Fallback mode triggered. Solenoid pin misaligned with bay rack.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-on-surface">BP-003 - Late Return Advisory</span>
                  <span className="text-[10px] bg-error/10 text-error font-bold px-1.5 py-0.5 rounded">
                    &gt;45m Limit
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  12m past standard campus transit limit. Push alert dispatched to student phone.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-on-surface">PP-LOCK-005 (Admin Hub)</span>
                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                    Secure
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Solenoid locked and secured. Return verified for Fleet unit BP-019 by Security Node.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
