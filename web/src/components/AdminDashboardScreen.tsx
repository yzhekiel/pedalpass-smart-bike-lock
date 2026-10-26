import React, { useState } from 'react';
import { ScreenType } from '../types';
import { USER_PROFILES, STATIONS } from '../data/mockData';

interface AdminDashboardScreenProps {
  onNavigate: (screen: ScreenType) => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ onNavigate }) => {
  const admin = USER_PROFILES.admin;
  const [activeAlertIndex, setActiveAlertIndex] = useState<number | null>(null);

  const hourlyUsage = [
    { hour: '6 AM', count: 12 },
    { hour: '7 AM', count: 48 },
    { hour: '8 AM', count: 87, peak: true },
    { hour: '9 AM', count: 62 },
    { hour: '10 AM', count: 45 },
    { hour: '11 AM', count: 54 },
    { hour: '12 PM', count: 70 },
    { hour: '1 PM', count: 58 },
    { hour: '2 PM', count: 42 },
    { hour: '3 PM', count: 51 },
    { hour: '4 PM', count: 68 },
    { hour: '5 PM', count: 79, peak: true },
    { hour: '6 PM', count: 34 },
  ];

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[720px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-sm">
              ED
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-[11px] font-bold text-primary tracking-wide">OPERATIONS CONTROL v3.4</span>
              </div>
              <h1 className="text-sm font-extrabold text-on-surface">{admin.name}</h1>
              <p className="text-[10px] text-on-surface-variant">All 4 Campus Hubs Online • Heartbeat 12s ago</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('depot_inventory')}
              className="px-3 py-1.5 rounded-lg bg-surface-container text-primary font-bold text-xs hover:bg-surface-container-high"
            >
              Depot Audit
            </button>
            <button
              onClick={() => alert('All systems nominal. MQTT latency: 32ms.')}
              className="w-9 h-9 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          {/* Critical Admin Alerts Ribbon */}
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Operational Health Alerts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0 mt-0.5">warning</span>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-on-surface">Gym Station Bay 02</h4>
                  <p className="text-[11px] text-on-surface-variant">Solenoid timeout recorded</p>
                  <button
                    onClick={() => onNavigate('resolution')}
                    className="text-[10px] text-primary font-bold hover:underline mt-1 block"
                  >
                    View WO #TKT-884
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">router</span>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-on-surface">IoT Mesh Network</h4>
                  <p className="text-[11px] text-on-surface-variant">98.4% uptime across gateways</p>
                  <span className="text-[10px] text-primary font-bold mt-1 block">Optimal</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">group</span>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-on-surface">Security Queue</h4>
                  <p className="text-[11px] text-on-surface-variant">Gate 1 inspection nominal</p>
                  <button
                    onClick={() => onNavigate('security')}
                    className="text-[10px] text-primary font-bold hover:underline mt-1 block"
                  >
                    Gate 1 View
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Key Operational Statistics Bento */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Fleet & Rider Statistics</h2>
              <span className="text-[11px] text-on-surface-variant">Live Telemetry</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-surface-container-low p-2.5 rounded-xl">
                <span className="text-[11px] text-on-surface-variant block">Total Campus Users</span>
                <span className="text-2xl font-extrabold text-on-surface">1,250</span>
                <span className="text-[10px] text-primary font-bold block mt-0.5">94% Active</span>
              </div>

              <div className="bg-surface-container-low p-2.5 rounded-xl">
                <span className="text-[11px] text-on-surface-variant block">Bicycles Available</span>
                <span className="text-2xl font-extrabold text-primary">32</span>
                <span className="text-[10px] text-on-surface-variant block mt-0.5">of 50 Total Fleet</span>
              </div>

              <div className="bg-surface-container-low p-2.5 rounded-xl">
                <span className="text-[11px] text-on-surface-variant block">Active In-Transit</span>
                <span className="text-2xl font-extrabold text-tertiary">12</span>
                <span className="text-[10px] text-on-surface-variant block mt-0.5">Peak Hour Normal</span>
              </div>

              <div className="bg-surface-container-low p-2.5 rounded-xl">
                <span className="text-[11px] text-on-surface-variant block">Today's Rides</span>
                <span className="text-2xl font-extrabold text-on-surface">87</span>
                <span className="text-[10px] text-primary font-bold block mt-0.5">Zero Incidents</span>
              </div>
            </div>
          </section>

          {/* Daily Campus Bicycle Usage Hourly Distribution Chart */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-on-surface">Hourly Bicycle Mobility Curve</h3>
                <p className="text-[11px] text-on-surface-variant">Class dismissal peaks at 08:00 AM & 05:00 PM</p>
              </div>
              <span className="text-xs bg-primary-fixed text-on-primary-fixed font-bold px-2 py-0.5 rounded-full">
                87 Peak
              </span>
            </div>

            {/* Custom Tailwind Bar Chart */}
            <div className="h-36 flex items-end justify-between gap-1 pt-4 px-1 border-b border-surface-container">
              {hourlyUsage.map((item, idx) => {
                const heightPercent = Math.round((item.count / 90) * 100);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-on-surface text-surface text-[9px] font-bold px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap shadow-sm">
                      {item.count} rides
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        item.peak
                          ? 'bg-primary ring-1 ring-primary/40'
                          : 'bg-surface-container-high group-hover:bg-primary-container'
                      }`}
                    ></div>
                    <span className="text-[8px] sm:text-[9px] text-outline truncate">{item.hour.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>

            {/* Breakdown ratios */}
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
                <span className="text-on-surface-variant">User Type Ratio:</span>
                <span className="font-bold text-on-surface">76% Student • 24% Faculty</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
                <span className="text-on-surface-variant">Fleet Condition:</span>
                <span className="font-bold text-primary">64% Avail • 24% In-Use • 12% Maint</span>
              </div>
            </div>
          </section>

          {/* Campus Hub Status Overview */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <h3 className="text-sm font-bold text-on-surface">Campus Hub Status Overview</h3>
              <span className="text-xs text-primary font-bold">4 Hubs Configured</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STATIONS.map((station) => (
                <div
                  key={station.id}
                  className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-on-surface">{station.name}</h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        station.status === 'optimal'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-tertiary/10 text-tertiary'
                      }`}
                    >
                      {station.status === 'optimal' ? 'Optimal' : station.statusMessage || 'Warning'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-on-surface-variant">
                    <span>
                      Available: <strong className="text-primary">{station.availableBikes}</strong>
                    </span>
                    <span>
                      Free Bays: <strong className="text-on-surface">{station.freeBays}</strong>
                    </span>
                    <span>Total: {station.totalBays}</span>
                  </div>

                  <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${Math.round((station.availableBikes / station.totalBays) * 100)}%`,
                      }}
                      className="h-full bg-primary rounded-full"
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Admin Management Shortcuts */}
          <section className="grid grid-cols-4 gap-2">
            {[
              { label: 'Manage Users', icon: 'manage_accounts', screen: 'home' },
              { label: 'Manage Bikes', icon: 'pedal_bike', screen: 'resolution' },
              { label: 'Manage QR Codes', icon: 'qr_code', screen: 'scan' },
              { label: 'System Logs', icon: 'analytics', screen: 'depot_inventory' },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={() => onNavigate(btn.screen as ScreenType)}
                className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 flex flex-col items-center gap-1 hover:bg-surface-container text-center shadow-xs"
              >
                <span className="material-symbols-outlined text-primary text-[20px]">{btn.icon}</span>
                <span className="text-[10px] font-bold text-on-surface">{btn.label}</span>
              </button>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
};
