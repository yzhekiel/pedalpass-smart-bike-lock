import React, { useState } from 'react';
import { ScreenType, WorkOrderItem } from '../types';
import { USER_PROFILES, WORK_ORDERS } from '../data/mockData';

interface MaintenanceDashboardScreenProps {
  onNavigate: (screen: ScreenType) => void;
  workOrders: WorkOrderItem[];
  onSelectWorkOrder: (order: WorkOrderItem) => void;
}

export const MaintenanceDashboardScreen: React.FC<MaintenanceDashboardScreenProps> = ({
  onNavigate,
  workOrders,
  onSelectWorkOrder,
}) => {
  const tech = USER_PROFILES.maintenance;
  const [pulseActive, setPulseActive] = useState(false);
  const [pulseLog, setPulseLog] = useState<string | null>(null);

  const handlePulseTest = () => {
    setPulseActive(true);
    setPulseLog('Sending 12V DC 500ms actuator pulse to PP-LOCK-BENCH-01...');
    setTimeout(() => {
      setPulseActive(false);
      setPulseLog('Solenoid plunger retracted in 42ms. Hall sensor detected magnetic release.');
    }, 1000);
  };

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[640px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <img
              src={tech.avatarUrl}
              alt={tech.name}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover border-2 border-primary shadow-sm"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                <span className="text-[11px] font-bold text-primary tracking-wide">LEAD MECHANIC ON DUTY</span>
              </div>
              <h1 className="text-sm font-extrabold text-on-surface">{tech.name}</h1>
              <p className="text-[10px] text-on-surface-variant">Central Workshop • DYCI Main Quad Depot Bay</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('depot_inventory')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container text-primary font-bold text-xs hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            <span>Parts Inventory</span>
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          {/* Shift Banner */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-primary text-[22px]">schedule</span>
              <div>
                <h3 className="text-xs font-bold text-on-surface">Shift: 07:00 AM - 04:00 PM</h3>
                <p className="text-[11px] text-on-surface-variant">Depot Standby • Radio Frequency Channel 4</p>
              </div>
            </div>
            <span className="text-xs bg-primary-fixed text-on-primary-fixed font-bold px-2 py-0.5 rounded-full">
              Bench Active
            </span>
          </section>

          {/* Fleet Status Metrics Bento */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Fleet Maintenance Status</h2>
              <span className="text-[11px] text-on-surface-variant font-medium">50 Total Campus Bicycles</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-surface-container-low p-2.5 rounded-xl">
                <div className="text-xl font-extrabold text-primary">38</div>
                <div className="text-[10px] text-on-surface-variant font-medium">Good Condition</div>
              </div>
              <div className="bg-surface-container-low p-2.5 rounded-xl">
                <div className="text-xl font-extrabold text-tertiary">6</div>
                <div className="text-[10px] text-on-surface-variant font-medium">Under Maint.</div>
              </div>
              <div className="bg-surface-container-low p-2.5 rounded-xl">
                <div className="text-xl font-extrabold text-error">4</div>
                <div className="text-[10px] text-on-surface-variant font-medium">Reported Issues</div>
              </div>
            </div>
          </section>

          {/* Depot Quick Actions */}
          <section className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'View Requests', icon: 'inbox', screen: 'resolution' },
              { label: 'Inspect Bicycle', icon: 'search', screen: 'resolution' },
              { label: 'Update Status', icon: 'edit_note', screen: 'resolution' },
              { label: 'Record Repair', icon: 'handyman', screen: 'resolution' },
              { label: 'Report Damage', icon: 'warning', screen: 'report_issue' },
              { label: 'Service History', icon: 'history', screen: 'ride_history' },
            ].map((act, i) => (
              <button
                key={i}
                onClick={() => onNavigate(act.screen as ScreenType)}
                className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 flex flex-col items-center gap-1 hover:bg-surface-container active:scale-95 transition-all text-center shadow-xs"
              >
                <span className="material-symbols-outlined text-primary text-[20px]">{act.icon}</span>
                <span className="text-[10px] font-bold text-on-surface leading-tight">{act.label}</span>
              </button>
            ))}
          </section>

          {/* Active Maintenance Work Queue */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">assignment</span>
                <h3 className="text-sm font-bold text-on-surface">Active Maintenance Work Queue</h3>
              </div>
              <span className="text-[10px] bg-tertiary/10 text-tertiary font-bold px-2 py-0.5 rounded-full">
                {workOrders.length} In Progress
              </span>
            </div>

            <div className="space-y-3">
              {workOrders.map((wo) => {
                const isP1 = wo.priority === 'P1';
                const isP2 = wo.priority === 'P2';
                return (
                  <div
                    key={wo.id}
                    className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-on-surface">{wo.id}</span>
                          <span className="text-xs font-bold text-primary font-mono">{wo.bikeId}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                              isP1
                                ? 'bg-error/10 text-error'
                                : isP2
                                ? 'bg-tertiary/10 text-tertiary'
                                : 'bg-primary/10 text-primary'
                            }`}
                          >
                            {wo.priorityLabel}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-on-surface mt-1">{wo.issueTitle}</h4>
                        <p className="text-[11px] text-on-surface-variant">
                          Location: {wo.station} ({wo.bay}) • Reported by {wo.reportedBy}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-outline-variant/30">
                      <span className="text-[10px] text-outline">{wo.timestamp}</span>
                      <button
                        onClick={() => {
                          onSelectWorkOrder(wo);
                          onNavigate('resolution');
                        }}
                        className="px-3 py-1.5 bg-primary text-on-primary font-bold text-xs rounded-lg hover:bg-primary-container shadow-xs"
                      >
                        Start Inspection
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ESP32 Smart Lock Pulse Diagnostic Workbench */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">bolt</span>
                <h3 className="text-sm font-bold text-on-surface">ESP32 Smart Lock Pulse Diagnostic</h3>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary font-mono font-bold px-2 py-0.5 rounded-full">
                Bench Node Online
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-surface-container-low rounded-lg">
                <span className="text-[10px] text-on-surface-variant block">Solenoid Latency</span>
                <span className="font-mono font-bold text-primary">48 ms</span>
              </div>
              <div className="p-2 bg-surface-container-low rounded-lg">
                <span className="text-[10px] text-on-surface-variant block">Hall Sensor Voltage</span>
                <span className="font-mono font-bold text-on-surface">Active (3.28V)</span>
              </div>
            </div>

            <button
              onClick={handlePulseTest}
              disabled={pulseActive}
              className="w-full py-2.5 bg-surface-container-highest border border-primary/40 text-primary font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-surface-container active:scale-98 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">
                {pulseActive ? 'sync' : 'electric_bolt'}
              </span>
              <span>{pulseActive ? 'Pulsing 12V Solenoid...' : 'Trigger 12V Pulse Test'}</span>
            </button>

            {pulseLog && (
              <div className="p-2 rounded bg-surface font-mono text-[10px] text-primary border border-primary/20">
                {pulseLog}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};
