/**
 * PedalPass — Staff Monitoring Web Portal
 * For campus security, maintenance technicians and administrators.
 * Students and faculty use the mobile app (../mobile).
 */

import React, { useEffect, useState } from 'react';
import { ScreenType, WorkOrderItem } from './types';
import { isSupabaseConfigured } from './lib/supabase';
import { StaffProfile, StaffRole, restoreStaffSession, staffSignOut } from './lib/auth';
import { USER_PROFILES, WORK_ORDERS } from './data/mockData';
import { LoginScreen } from './components/LoginScreen';
import { PedalPassLogo } from './components/PedalPassLogo';
import { SecurityScreen } from './components/SecurityScreen';
import { ReportIssueScreen } from './components/ReportIssueScreen';
import { MaintenanceDashboardScreen } from './components/MaintenanceDashboardScreen';
import { WorkOrderResolutionScreen } from './components/WorkOrderResolutionScreen';
import { AdminDashboardScreen } from './components/AdminDashboardScreen';
import { DepotInventoryScreen } from './components/DepotInventoryScreen';

type NavItem = { id: ScreenType; label: string; icon: string };

const NAV: Record<StaffRole, NavItem[]> = {
  admin: [
    { id: 'admin_dashboard', label: 'Overview', icon: 'dashboard' },
    { id: 'security', label: 'Fleet & Security', icon: 'shield' },
    { id: 'maintenance', label: 'Maintenance', icon: 'build' },
    { id: 'resolution', label: 'Work Order', icon: 'assignment_turned_in' },
    { id: 'depot_inventory', label: 'Parts Inventory', icon: 'inventory_2' },
    { id: 'report_issue', label: 'Report Issue', icon: 'report_problem' },
  ],
  security: [
    { id: 'security', label: 'Fleet & Security', icon: 'shield' },
    { id: 'report_issue', label: 'Report Issue', icon: 'report_problem' },
  ],
  maintenance: [
    { id: 'maintenance', label: 'Maintenance', icon: 'build' },
    { id: 'resolution', label: 'Work Order', icon: 'assignment_turned_in' },
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
  const [role, setRole] = useState<StaffRole | null>(null);
  const [screen, setScreen] = useState<ScreenType>('admin_dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>(WORK_ORDERS);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderItem>(WORK_ORDERS[0]);
  const [profile, setProfile] = useState<StaffProfile | null>(null); // signed-in Supabase staff
  const [restoring, setRestoring] = useState(isSupabaseConfigured);

  const login = (r: StaffRole, p?: StaffProfile) => {
    setProfile(p ?? null);
    setRole(r);
    setScreen(HOME[r]);
  };

  // Stay signed in after a page refresh
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    restoreStaffSession()
      .then((p) => {
        if (p) login(p.role, p);
      })
      .finally(() => setRestoring(false));
  }, []);

  if (restoring) return <div className="min-h-screen bg-background" />;

  if (!role) {
    return <LoginScreen onLogin={login} />;
  }

  const nav = NAV[role];
  const user = profile ?? USER_PROFILES[role];

  // Screens were designed with links to student screens; keep staff inside their allowed pages.
  const navigate = (target: ScreenType) => {
    const allowed = nav.some((n) => n.id === target);
    setScreen(allowed ? target : HOME[role]);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const logout = () => {
    if (profile) staffSignOut();
    setProfile(null);
    setRole(null);
    setMenuOpen(false);
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
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-white/30 bg-white/10"
              />
            ) : (
              <div className="w-9 h-9 shrink-0 rounded-full border border-white/30 bg-white/10 flex items-center justify-center text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{user.name}</p>
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
              <h1 className="text-base font-extrabold">{current?.label ?? 'Dashboard'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-[#006948] animate-pulse" />
            <span className="hidden sm:inline">Live • mock data</span>
          </div>
        </header>

        <div className="web-main">
          {screen === 'security' && <SecurityScreen onNavigate={navigate} />}

          {screen === 'report_issue' && (
            <ReportIssueScreen
              onNavigate={navigate}
              onSubmitTicket={(ticket) => setWorkOrders((prev) => [ticket, ...prev])}
            />
          )}

          {screen === 'maintenance' && (
            <MaintenanceDashboardScreen
              workOrders={workOrders}
              onNavigate={navigate}
              onSelectWorkOrder={(order) => {
                setSelectedWorkOrder(order);
                navigate('resolution');
              }}
            />
          )}

          {screen === 'resolution' && (
            <WorkOrderResolutionScreen
              order={selectedWorkOrder}
              onNavigate={navigate}
              onResolveOrder={(id) => setWorkOrders((prev) => prev.filter((w) => w.id !== id))}
            />
          )}

          {screen === 'admin_dashboard' && <AdminDashboardScreen onNavigate={navigate} />}

          {screen === 'depot_inventory' && <DepotInventoryScreen onNavigate={navigate} />}
        </div>
      </div>
    </div>
  );
}
