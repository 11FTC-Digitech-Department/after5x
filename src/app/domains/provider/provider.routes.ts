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
        path: '',
        redirectTo: '/p/dashboard',
        pathMatch: 'full',
      },
    ],
  },
];