/**
 * PedalPass — Admin Web Portal (dark dashboard layout: left sidebar + top bar)
 * For PedalPass admins: identity approvals, reports and the maintenance list, fleet & SOS alerts,
 * bike history, QR codes and analytics. Riders (students and faculty/staff) use the mobile app (../mobile).
 * Maintenance has no account: the admin contacts them and marks bikes fixed.
 * Every screen reads live data from Supabase (src/lib/data.ts).
 */

import React, { useEffect, useRef, useState } from 'react';
import { ScreenType, WorkOrderItem } from './types';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { StaffProfile, restoreStaffSession, staffSignOut } from './lib/auth';
import { LoginScreen } from './components/LoginScreen';
import { LandingPage } from './components/LandingPage';
import { PedalPassLogo } from './components/PedalPassLogo';
import { SecurityScreen } from './components/SecurityScreen';
import { ReportsListScreen } from './components/ReportsListScreen';
import { MaintenanceListScreen } from './components/MaintenanceListScreen';
import { BikeHistoryScreen } from './components/BikeHistoryScreen';
import { BikesScreen } from './components/BikesScreen';
import { ActivityLogScreen } from './components/ActivityLogScreen';
import { AnalyticsScreen } from './components/AnalyticsScreen';
import { WorkOrderResolutionScreen } from './components/WorkOrderResolutionScreen';
import { AdminDashboardScreen } from './components/AdminDashboardScreen';
import { VerificationsScreen } from './components/VerificationsScreen';
import { QrCodesScreen } from './components/QrCodesScreen';

/** `lower`: second sidebar group. `under`: not in the sidebar; highlights that item instead. */
type NavItem = { id: ScreenType; label: string; icon: string; title: string; subtitle: string; lower?: boolean; under?: ScreenType };

/** Sidebar items; `lower` ones sit in the second group (like Settings / Help Center). */
const NAV: NavItem[] = [
  { id: 'admin_dashboard', label: 'Dashboard', icon: 'space_dashboard', title: 'Dashboard', subtitle: 'PedalPass at a glance' },
  { id: 'maintenance', label: 'Reports', icon: 'list_alt', title: 'List of Reports', subtitle: 'Every problem riders and admins reported, open and fixed' },
  { id: 'maintenance_list', label: 'Maintenance', icon: 'build', title: 'Maintenance List', subtitle: 'Bikes that need maintenance right now' },
  { id: 'bikes', label: 'Bikes', icon: 'pedal_bike', title: 'Bikes', subtitle: 'Every bike, its lock battery, status and lock' },
  { id: 'bike_history', label: 'Bike History', icon: 'history', title: 'Bike History', subtitle: 'Riders, reports, repairs and swaps for this bike', under: 'bikes' },
  { id: 'verifications', label: 'Approvals', icon: 'how_to_reg', title: 'Identity Approvals', subtitle: 'Riders waiting for their identity check' },
  { id: 'analytics', label: 'Analytics', icon: 'monitoring', title: 'Analytics', subtitle: 'Usage trends, comparisons and recommendations' },
  { id: 'security', label: 'Fleet & Security', icon: 'shield', title: 'Fleet & Security', subtitle: 'Riders on the road and SOS alerts' },
  { id: 'qr_codes', label: 'QR Codes', icon: 'qr_code_2', title: 'QR Codes', subtitle: 'Print or regenerate bike QR codes', lower: true },
  { id: 'activity_log', label: 'Activity Log', icon: 'receipt_long', title: 'Activity Log', subtitle: 'Everything that happened in PedalPass', lower: true },
];

const HOME: ScreenType = 'admin_dashboard';

/** Closes a dropdown when clicking anywhere else. */
function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);
  return ref;
}

export default function App() {
  const [profile, setProfile] = useState<StaffProfile | null>(null); // the signed-in admin
  const [authView, setAuthView] = useState<'landing' | 'login'>('landing');
  const [screen, setScreen] = useState<ScreenType>(HOME);
  const [menuOpen, setMenuOpen] = useState(false); // sidebar on phones
  const [accountOpen, setAccountOpen] = useState(false);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderItem | null>(null);
  const [focusBike, setFocusBike] = useState(''); // bike opened from another page, for Bike History / Activity Log / Reports
  const [restoring, setRestoring] = useState(isSupabaseConfigured);
  const accountRef = useClickOutside(accountOpen, () => setAccountOpen(false));

  const login = (p: StaffProfile) => {
    setProfile(p);
    setScreen(HOME);
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

  // Red dot on the bell while SOS / low-stock alerts are open
  useEffect(() => {
    if (!profile) return;
    const check = () =>
      supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('resolved', false)
        .then(({ count }) => setOpenAlerts(count ?? 0));
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [profile]);

  if (restoring) return <div className="min-h-screen bg-background" />;

  if (!profile) {
    if (authView === 'login') {
      return <LoginScreen onLogin={(_, p) => login(p)} onBack={() => setAuthView('landing')} />;
    }
    return <LandingPage onAdminLogin={() => setAuthView('login')} />;
  }

  // Older screens link to rider screens; keep admins inside their pages.
  const navigate = (target: ScreenType) => {
    const allowed = NAV.some((n) => n.id === target) || target === 'resolution';
    setScreen(allowed ? target : HOME);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  /** From the sidebar / menus: open the page without a bike pre-selected. */
  const goTo = (target: ScreenType) => {
    setFocusBike('');
    navigate(target);
  };

  const logout = () => {
    staffSignOut();
    setProfile(null);
    setAuthView('landing');
    setSelectedWorkOrder(null);
    setAccountOpen(false);
  };

  /** Maintenance said the bike is fixed: open "Mark as Fixed" for that report. */
  const openMarkFixed = (order: WorkOrderItem) => {
    setSelectedWorkOrder(order);
    navigate('resolution');
  };

  const openBike = (bikeId: string, target: 'bike_history' | 'activity_log' | 'maintenance') => {
    setFocusBike(bikeId);
    navigate(target);
  };

  const current = screen === 'resolution' ? { title: 'Mark as Fixed', subtitle: 'Record what maintenance fixed' } : NAV.find((n) => n.id === screen);

  const navButton = (item: NavItem) => {
    const active =
      item.id === screen ||
      (screen === 'resolution' && item.id === 'maintenance') ||
      NAV.some((n) => n.id === screen && n.under === item.id);
    return (
      <button
        key={item.id}
        onClick={() => goTo(item.id)}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
          active ? 'bg-primary text-on-primary font-semibold shadow-[0_6px_20px_-6px_rgba(26,63,174,0.8)]' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
        }`}
      >
        <span className={`material-symbols-outlined text-[20px] ${active ? 'fill-icon' : ''}`}>{item.icon}</span>
        {item.label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans antialiased lg:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-dim border-r border-outline-variant/60 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button onClick={() => goTo(HOME)} className="flex items-center gap-2.5 px-6 pt-6 pb-5">
          <span className="w-9 h-9 rounded-xl bg-primary-light/20 flex items-center justify-center">
            <PedalPassLogo size={26} showOuterCard={false} />
          </span>
          <span className="text-lg font-bold tracking-wide">PedalPass</span>
        </button>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1">
          {NAV.filter((n) => !n.lower && !n.under).map(navButton)}
          <div className="my-4 border-t border-outline-variant/60" />
          {NAV.filter((n) => n.lower && !n.under).map(navButton)}
        </nav>

      </aside>

      {menuOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-outline-variant/40">
          <div className="h-[72px] px-4 lg:px-8 flex items-center gap-4">
            <button
              onClick={() => setMenuOpen(true)}
              className="lg:hidden w-10 h-10 rounded-xl border border-outline-variant/60 flex items-center justify-center"
              aria-label="Open menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{current?.title}</h1>
              {current?.subtitle && <p className="text-xs text-on-surface-variant truncate hidden sm:block">{current.subtitle}</p>}
            </div>

            <div className="flex-1" />

            <button
              onClick={() => goTo('security')}
              className="relative w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              aria-label={`${openAlerts} open alerts`}
              title="Alerts"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {openAlerts > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-tertiary ring-2 ring-background" />}
            </button>

            <div ref={accountRef} className="relative">
              <button onClick={() => setAccountOpen(!accountOpen)} className="flex items-center gap-3" aria-label="Account">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-primary-light/25 text-primary-light flex items-center justify-center text-sm font-bold">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="hidden sm:block text-left">
                  <span className="block text-sm font-semibold leading-tight">{profile.name}</span>
                  <span className="block text-xs text-on-surface-variant">Admin</span>
                </span>
                <span className="material-symbols-outlined text-[20px] text-tertiary hidden sm:block">expand_more</span>
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-2xl p-1.5">
                  <div className="px-3 py-2.5 border-b border-outline-variant/60 mb-1">
                    <p className="text-sm font-semibold truncate">{profile.name}</p>
                    <p className="text-xs text-on-surface-variant truncate">{profile.email}</p>
                  </div>
                  <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-surface-container">
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="web-main pb-12">
          {screen === 'admin_dashboard' && <AdminDashboardScreen profile={profile} onNavigate={goTo} onOpenBike={(id) => openBike(id, 'bike_history')} />}

          {screen === 'maintenance' && (
            <ReportsListScreen
              key={focusBike}
              initialSearch={focusBike}
              onNavigate={navigate}
              onOpen={openMarkFixed}
              onBikeHistory={(id) => openBike(id, 'bike_history')}
            />
          )}

          {screen === 'maintenance_list' && (
            <MaintenanceListScreen onOpenReports={(id) => openBike(id, 'maintenance')} onBikeHistory={(id) => openBike(id, 'bike_history')} />
          )}

          {screen === 'resolution' && selectedWorkOrder && (
            <WorkOrderResolutionScreen order={selectedWorkOrder} onNavigate={navigate} onResolved={() => setSelectedWorkOrder(null)} />
          )}

          {screen === 'bikes' && <BikesScreen onHistory={(id) => openBike(id, 'bike_history')} />}

          {screen === 'bike_history' && (
            <BikeHistoryScreen
              key={focusBike}
              initialBikeId={focusBike}
              onOpenLog={(id) => openBike(id, 'activity_log')}
              onBack={() => goTo('bikes')}
            />
          )}

          {screen === 'verifications' && <VerificationsScreen />}

          {screen === 'analytics' && <AnalyticsScreen onOpenBike={(id) => openBike(id, 'bike_history')} />}

          {screen === 'security' && <SecurityScreen profile={profile} onNavigate={navigate} />}

          {screen === 'qr_codes' && <QrCodesScreen />}

          {screen === 'activity_log' && <ActivityLogScreen key={focusBike} initialBikeId={focusBike} />}
        </main>
      </div>
    </div>
  );
}
