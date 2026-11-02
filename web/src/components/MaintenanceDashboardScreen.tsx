import React from 'react';
import { ScreenType, WorkOrderItem } from '../types';
import { StaffProfile } from '../lib/auth';
import { fetchBikes, loadingText, useQuery } from '../lib/data';

interface MaintenanceDashboardScreenProps {
  profile: StaffProfile;
  onNavigate: (screen: ScreenType) => void;
  workOrders: WorkOrderItem[];
  onSelectWorkOrder: (order: WorkOrderItem) => void;
}

export const MaintenanceDashboardScreen: React.FC<MaintenanceDashboardScreenProps> = ({
  profile,
  onNavigate,
  workOrders,
  onSelectWorkOrder,
}) => {
  const { data: bikes, error } = useQuery(fetchBikes);

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[640px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-sm">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                <span className="text-[11px] font-bold text-primary tracking-wide">ON DUTY</span>
              </div>
              <h1 className="text-sm font-extrabold text-on-surface">{profile.name}</h1>
              {profile.title && <p className="text-[10px] text-on-surface-variant">{profile.title}</p>}
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
          {/* Fleet Status Metrics */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Fleet Maintenance Status</h2>
              <span className="text-[11px] text-on-surface-variant font-medium">
                {bikes ? `${bikes.length} Campus Bicycles` : loadingText(error)}
              </span>
            </div>

            {bikes && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-surface-container-low p-2.5 rounded-xl">
                  <div className="text-xl font-extrabold text-primary">
                    {bikes.filter((b) => b.status === 'available' || b.status === 'in_use').length}
                  </div>
                  <div className="text-[10px] text-on-surface-variant font-medium">Good Condition</div>
                </div>
                <div className="bg-surface-container-low p-2.5 rounded-xl">
                  <div className="text-xl font-extrabold text-tertiary">
                    {bikes.filter((b) => b.status === 'maintenance').length}
                  </div>
                  <div className="text-[10px] text-on-surface-variant font-medium">Under Maint.</div>
                </div>
                <div className="bg-surface-container-low p-2.5 rounded-xl">
                  <div className="text-xl font-extrabold text-error">{workOrders.length}</div>
                  <div className="text-[10px] text-on-surface-variant font-medium">Open Tickets</div>
                </div>
              </div>
            )}
          </section>

          {/* Active Maintenance Work Queue */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">assignment</span>
                <h3 className="text-sm font-bold text-on-surface">Maintenance Work Queue</h3>
              </div>
              <span className="text-[10px] bg-tertiary/10 text-tertiary font-bold px-2 py-0.5 rounded-full">
                {workOrders.length} Open
              </span>
            </div>

            {workOrders.length === 0 && (
              <p className="text-xs text-on-surface-variant py-4 text-center">No open tickets. All reported issues are resolved.</p>
            )}

            <div className="space-y-3">
              {workOrders.map((wo) => {
                const isP1 = wo.priority === 'P1';
                const isP2 = wo.priority === 'P2';
                return (
                  <div
                    key={wo.id}
                    className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/50 space-y-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-on-surface">{wo.id}</span>
                        <span className="text-xs font-bold text-primary font-mono">{wo.bikeId}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isP1 ? 'bg-error/10 text-error' : isP2 ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {wo.priorityLabel}
                        </span>
                        <span className="text-[10px] text-outline">{wo.status}</span>
                      </div>
                      <h4 className="text-xs font-bold text-on-surface mt-1">{wo.issueTitle}</h4>
                      <p className="text-[11px] text-on-surface-variant">
                        Location: {wo.station} ({wo.bay}) • Reported by {wo.reportedBy}
                        {wo.assignedTech && <> • Assigned to {wo.assignedTech}</>}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-outline-variant/30">
                      <span className="text-[10px] text-outline">{wo.timestamp}</span>
                      <button
                        onClick={() => onSelectWorkOrder(wo)}
                        className="px-3 py-1.5 bg-primary text-on-primary font-bold text-xs rounded-lg hover:bg-primary-container shadow-xs"
                      >
                        {wo.status === 'Under Inspection' ? 'Continue' : 'Start Inspection'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <button
            onClick={() => onNavigate('report_issue')}
            className="w-full py-2.5 rounded-xl border border-outline-variant text-xs font-bold text-primary hover:bg-surface-container flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">warning</span>
            Report a damaged bicycle
          </button>
        </main>
      </div>
    </div>
  );
};
