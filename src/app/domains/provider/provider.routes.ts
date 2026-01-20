import { Routes } from '@angular/router';
import { ProviderTabsPage } from './provider-tabs/provider-tabs.page';

export const PROVIDER_ROUTES: Routes = [
  {
    path: '',
    component: ProviderTabsPage,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
      },
      {
        path: 'schedule',
        loadComponent: () => import('./pages/schedule/schedule.page').then(m => m.SchedulePage),
      },
      {
        path: 'wallet',
        loadComponent: () => import('./pages/wallet/wallet.page').then(m => m.WalletPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage),
      },
      {
        path: '',
        redirectTo: '/p/dashboard',
        pathMatch: 'full',
      },
    ],
  },
  // Full-screen routes (outside tabs)
  {
    path: 'job/:bookingId',
    loadComponent: () => import('./pages/job-execution/job-execution.page').then(m => m.JobExecutionPage),
  },
  {
    path: 'notifications',
    loadComponent: () => import('./pages/notifications/notifications.page').then(m => m.NotificationsPage),
  },
];
