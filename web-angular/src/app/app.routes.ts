import { Routes } from '@angular/router';
import { adminGuard } from './core/auth.guard';
import { Shell } from './layout/shell';

/**
 * URL → page. Every portal page sits inside the Shell (sidebar + top bar) and needs a signed-in admin.
 * Pages are loaded only when first opened (loadComponent), which keeps the first load small.
 */
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login), title: 'Sign in · PedalPass' },
  {
    path: '',
    component: Shell,
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardPage),
        data: { title: 'Dashboard' },
        title: 'Dashboard · PedalPass',
      },
      {
        path: 'bikes',
        loadComponent: () => import('./pages/bikes/bikes').then((m) => m.BikesPage),
        data: { title: 'Bikes' },
        title: 'Bikes · PedalPass',
      },
      {
        path: 'bikes/:id', // the bike code arrives as the page's `id` input
        loadComponent: () => import('./pages/bike-detail/bike-detail').then((m) => m.BikeDetailPage),
        data: { title: 'Bike History' },
        title: 'Bike History · PedalPass',
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/reports/reports').then((m) => m.ReportsPage),
        data: { title: 'List of Reports' },
        title: 'Reports · PedalPass',
      },
      {
        path: 'approvals',
        loadComponent: () => import('./pages/approvals/approvals').then((m) => m.ApprovalsPage),
        data: { title: 'Identity Approvals' },
        title: 'Approvals · PedalPass',
      },
      {
        path: 'activity',
        loadComponent: () => import('./pages/activity/activity').then((m) => m.ActivityPage),
        data: { title: 'Activity Log' },
        title: 'Activity Log · PedalPass',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
