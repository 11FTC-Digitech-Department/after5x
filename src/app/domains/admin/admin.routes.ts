import { Routes } from '@angular/router';
import { AdminTabsPage } from './admin-tabs/admin-tabs.page';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminTabsPage,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
      },
      {
        path: '',
        redirectTo: '/a/dashboard',
        pathMatch: 'full',
      },
    ],
  },
];