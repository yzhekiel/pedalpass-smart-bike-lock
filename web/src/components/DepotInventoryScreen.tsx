import React, { useState } from 'react';
import { ScreenType } from '../types';
import { INVENTORY_ITEMS, WORK_ORDERS, USER_PROFILES } from '../data/mockData';

interface DepotInventoryScreenProps {
  onNavigate: (screen: ScreenType) => void;
}

export const DepotInventoryScreen: React.FC<DepotInventoryScreenProps> = ({ onNavigate }) => {
  const [items, setItems] = useState(INVENTORY_ITEMS);
  const [restockSuccess, setRestockSuccess] = useState<string | null>(null);

  const handleRestock = (itemName: string) => {
    setRestockSuccess(`Purchase requisition created for ${itemName}. Sent to DYCI Procurement.`);
    setTimeout(() => setRestockSuccess(null), 3000);
  };

  const handleExportReport = () => {
    alert('DYCI-MNT-B1-AUDIT-2026.pdf generated! Download complete.');
  };

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[720px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container relative">
        {/* Toast */}
        {restockSuccess && (
          <div className="fixed top-12 z-50 left-1/2 -translate-x-1/2 max-w-sm w-[90%] bg-surface-container-highest text-on-surface px-4 py-2 rounded-xl shadow-xl border border-primary text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
            <span className="material-symbols-outlined text-primary text-[18px]">shopping_cart</span>
            <span>{restockSuccess}</span>
          </div>
        )}

        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('admin_dashboard')}
              aria-label="Go Back"
              className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-transform"
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <div>
              <h1 className="text-base font-bold text-on-surface">Depot Inventory & Parts</h1>
              <p className="text-[11px] text-primary font-bold">Depot Code: DYCI-MNT-B1 • Central Hub</p>
            </div>
          </div>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-xs shadow-xs hover:bg-primary-container"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export Audit</span>
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          {/* 2x2 Bento Performance Cards */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
              <span className="text-[11px] text-on-surface-variant block">Fleet Health</span>
              <div className="text-2xl font-extrabold text-primary">95.8%</div>
              <span className="text-[10px] text-primary font-bold block mt-0.5">Target: &gt;92%</span>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
              <span className="text-[11px] text-on-surface-variant block">Open Work Orders</span>
              <div className="text-2xl font-extrabold text-tertiary">2 Open</div>
              <span className="text-[10px] text-on-surface-variant block mt-0.5">Bench 1 & 2</span>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
              <span className="text-[11px] text-on-surface-variant block">Avg Turnaround</span>
              <div className="text-2xl font-extrabold text-on-surface">1h 24m</div>
              <span className="text-[10px] text-primary font-bold block mt-0.5">-18% vs Last Month</span>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm">
              <span className="text-[11px] text-on-surface-variant block">Parts Budget Spent</span>
              <div className="text-2xl font-extrabold text-on-surface">₱3,450</div>
              <span className="text-[10px] text-on-surface-variant block mt-0.5">of ₱15,000 Allocation</span>
            </div>
          </section>

          {/* Depot Parts Stock Level List */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">category</span>
                <h2 className="text-sm font-bold text-on-surface">Depot Hardware & Components Stock</h2>
              </div>
              <span className="text-xs text-on-surface-variant font-mono">6 SKUs Monitored</span>
            </div>

            <div className="space-y-3">
              {items.map((item) => {
                const isCritical = item.statusType === 'critical';
                const isWarning = item.statusType === 'warning';
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-on-surface">{item.name}</h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                              isCritical
                                ? 'bg-error text-on-error'
                                : isWarning
                                ? 'bg-tertiary text-on-tertiary'
                                : 'bg-primary/10 text-primary'
                            }`}
                          >
                            {item.statusTag}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant">{item.description}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-extrabold text-on-surface">
                          {item.stock}{' '}
                          <span className="text-[10px] font-normal text-on-surface-variant">{item.unit}</span>
                        </span>
                        {(isCritical || isWarning) && (
                          <button
                            onClick={() => handleRestock(item.name)}
                            className="block text-[10px] text-primary font-bold hover:underline mt-0.5"
                          >
                            Reorder Now
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                      <div
                        style={{ width: `${item.percentage}%` }}
                        className={`h-full rounded-full ${
                          isCritical ? 'bg-error' : isWarning ? 'bg-tertiary' : 'bg-primary'
                        }`}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Top Reported Failure Modes */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Top Reported Failure Modes (Past 30 Days)
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-on-surface font-semibold mb-1">
                  <span>Brake pad wear & rotor rubbing</span>
                  <span className="text-primary font-bold">42%</span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[42%] rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-on-surface font-semibold mb-1">
                  <span>IoT smart lock battery depletion (18650 cells)</span>
                  <span className="text-tertiary font-bold">28%</span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-tertiary w-[28%] rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-on-surface font-semibold mb-1">
                  <span>Solenoid latch pin misalignment</span>
                  <span className="text-secondary font-bold">18%</span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-secondary w-[18%] rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-on-surface font-semibold mb-1">
                  <span>Tire punctures & Schrader valve leakage</span>
                  <span className="text-outline font-bold">12%</span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-outline w-[12%] rounded-full"></div>
                </div>
              </div>
            </div>
          </section>

          {/* Technician Shift Roster */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <h3 className="text-sm font-bold text-on-surface">Depot Technician Duty Roster</h3>
              <span className="text-xs text-primary font-bold">Active Shift</span>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={USER_PROFILES.maintenance.avatarUrl}
                    alt="Kuya Noel"
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-primary shrink-0"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-on-surface">{USER_PROFILES.maintenance.name}</h4>
                    <p className="text-[11px] text-on-surface-variant">Lead Mechanic • On Duty (Bench 1)</p>
                  </div>
                </div>
                <span className="text-[10px] bg-primary-fixed text-on-primary-fixed font-bold px-2 py-0.5 rounded">
                  Active
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={USER_PROFILES.security.avatarUrl}
                    alt="Officer Mendoza"
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-outline-variant shrink-0"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-on-surface">{USER_PROFILES.security.name}</h4>
                    <p className="text-[11px] text-on-surface-variant">Security & Recovery Escort</p>
                  </div>
                </div>
                <span className="text-[10px] bg-surface-container text-on-surface-variant font-bold px-2 py-0.5 rounded">
                  Gate 1
                </span>
              </div>
            </div>
          </section>

          {/* Audit CTA */}
          <div className="pt-2">
            <button
              onClick={handleExportReport}
              className="w-full h-[52px] bg-primary text-on-primary rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:bg-primary-container active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">print</span>
              <span>Generate & Export Full Audit Report (PDF/Excel)</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
