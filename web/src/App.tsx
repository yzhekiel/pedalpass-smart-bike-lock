/**
 * PedalPass — Staff Monitoring Web Portal
 * For campus security, maintenance technicians and administrators.
 * Students and faculty use the mobile app (../mobile).
 * Every screen reads live data from Supabase (src/lib/data.ts).
 */

import React, { useEffect, useState } from 'react';
import { ScreenType, WorkOrderItem } from './types';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { StaffProfile, StaffRole, restoreStaffSession, staffSignOut } from './lib/auth';
import { fetchOpenWorkOrders } from './lib/data';
import { LoginScreen } from './components/LoginScreen';
import { PedalPassLogo } from './components/PedalPassLogo';
import { SecurityScreen } from './components/SecurityScreen';
import { ReportIssueScreen } from './components/ReportIssueScreen';
import { MaintenanceDashboardScreen } from './components/MaintenanceDashboardScreen';
import { WorkOrderResolutionScreen } from './components/WorkOrderResolutionScreen';
import { AdminDashboardScreen } from './components/AdminDashboardScreen';
import { DepotInventoryScreen } from './components/DepotInventoryScreen';
import { VerificationsScreen } from './components/VerificationsScreen';

type NavItem = { id: ScreenType; label: string; icon: string };

const NAV: Record<StaffRole, NavItem[]> = {
  admin: [
    { id: 'admin_dashboard', label: 'Overview', icon: 'dashboard' },
    { id: 'verifications', label: 'Identity Approvals', icon: 'how_to_reg' },
    { id: 'security', label: 'Fleet & Security', icon: 'shield' },
    { id: 'maintenance', label: 'Maintenance', icon: 'build' },
    { id: 'depot_inventory', label: 'Parts Inventory', icon: 'inventory_2' },
    { id: 'report_issue', label: 'Report Issue', icon: 'report_problem' },
  ],
  security: [
    { id: 'security', label: 'Fleet & Security', icon: 'shield' },
    { id: 'verifications', label: 'Identity Approvals', icon: 'how_to_reg' },
    { id: 'report_issue', label: 'Report Issue', icon: 'report_problem' },
  ],
  maintenance: [
    { id: 'maintenance', label: 'Maintenance', icon: 'build' },
    { id: 'depot_inventory', label: 'Parts Inventory', icon: 'inventory_2' },
    { id: 'report_issue', label: 'Report Issue', icon: 'report_problem' },
  ],
};

const HOME: Record<StaffRole, ScreenType> = {
  admin: 'admin_dashboard',
  security: 'security',
  maintenance: 'maintenance',
};

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: 'Administrator',
  security: 'Campus Security',
  maintenance: 'Maintenance',
};

export default function App() {
  const [profile, setProfile] = useState<StaffProfile | null>(null); // the signed-in staff member
  const [screen, setScreen] = useState<ScreenType>('admin_dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderItem | null>(null);
  const [restoring, setRestoring] = useState(isSupabaseConfigured);

  const reloadWorkOrders = () => fetchOpenWorkOrders().then(setWorkOrders).catch(() => {});

  const login = (p: StaffProfile) => {
    setProfile(p);
    setScreen(HOME[p.role]);
    reloadWorkOrders();
  };

  // Stay signed in after a page refresh
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    restoreStaffSession()
      .then((p) => {
        if (p) login(p);
      })
      .finally(() => setRestoring(false));
  }, []);

  // Keep the work-order queue fresh while the portal is open
  useEffect(() => {
    if (!profile) return;
    const timer = setInterval(reloadWorkOrders, 30_000);
    return () => clearInterval(timer);
  }, [profile]);

  if (restoring) return <div className="min-h-screen bg-background" />;

  if (!profile) {
    return <LoginScreen onLogin={(_, p) => login(p)} />;
  }

  const role = profile.role;
  const nav = NAV[role];

  // Screens were designed with links to student screens; keep staff inside their allowed pages.
  const navigate = (target: ScreenType) => {
    const allowed = nav.some((n) => n.id === target) || (target === 'resolution' && role !== 'security');
    setScreen(allowed ? target : HOME[role]);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const logout = () => {
    staffSignOut();
    setProfile(null);
    setWorkOrders([]);
    setSelectedWorkOrder(null);
    setMenuOpen(false);
  };

  /** The technician opens a ticket: mark it under inspection and assign it to them. */
  const startInspection = async (order: WorkOrderItem) => {
    const { error } = await supabase
      .from('work_orders')
      .update({ status: 'Under Inspection', assigned_tech: profile.name })
      .eq('id', order.id);
    if (error) {
      alert(`Could not open the ticket: ${error.message}`);
      return;
    }
    setSelectedWorkOrder({ ...order, status: 'Under Inspection', assignedTech: profile.name });
    reloadWorkOrders();
    navigate('resolution');
  };

  const current = nav.find((n) => n.id === screen);

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans antialiased lg:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#081c5e] text-white flex flex-col transform transition-transform duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <PedalPassLogo size={40} />
          <div>
            <p className="font-extrabold leading-tight">PedalPass</p>
            <p className="text-[11px] text-white/60">Staff Monitoring Portal</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = item.id === screen;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-primary-fixed text-on-primary-fixed' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-white/30 bg-white/10"
              />
            ) : (
              <div className="w-9 h-9 shrink-0 rounded-full border border-white/30 bg-white/10 flex items-center justify-center text-xs font-bold">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{profile.name}</p>
              <p className="text-[11px] text-white/60">{ROLE_LABEL[role]}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign out
          </button>
        </div>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="bg-surface border-b border-outline-variant/40 px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface-container"
              aria-label="Open menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <p className="text-[11px] font-bold text-primary uppercase tracking-wider">{ROLE_LABEL[role]}</p>
              <h1 className="text-base font-extrabold">{current?.label ?? 'Work Order'}</h1>
            </div>
          </div>
        </header>

        <div className="web-main">
          {screen === 'security' && <SecurityScreen profile={profile} onNavigate={navigate} />}

          {screen === 'report_issue' && (
            <ReportIssueScreen
              profile={profile}
              onNavigate={navigate}
              onSubmitted={() => {
                reloadWorkOrders();
                navigate('maintenance');
              }}
            />
          )}

          {screen === 'maintenance' && (
            <MaintenanceDashboardScreen
              profile={profile}
              workOrders={workOrders}
              onNavigate={navigate}
              onSelectWorkOrder={startInspection}
            />
          )}

          {screen === 'resolution' && selectedWorkOrder && (
            <WorkOrderResolutionScreen
              order={selectedWorkOrder}
              onNavigate={navigate}
              onResolved={() => {
                setSelectedWorkOrder(null);
                reloadWorkOrders();
              }}
            />
          )}

          {screen === 'admin_dashboard' && <AdminDashboardScreen profile={profile} onNavigate={navigate} />}

          {screen === 'depot_inventory' && <DepotInventoryScreen onNavigate={navigate} />}

          {screen === 'verifications' && <VerificationsScreen />}
        </div>
      </div>
    </div>
  );
}
