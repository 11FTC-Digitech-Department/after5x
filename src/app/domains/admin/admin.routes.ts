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
        path: 'users',
        loadComponent: () => import('./pages/users/users.page').then(m => m.UsersPage),
      },
      {
        path: 'providers',
        loadComponent: () => import('./pages/providers/providers.page').then(m => m.ProvidersPage),
      },
      {
        path: 'bookings',
        loadComponent: () => import('./pages/bookings/bookings.page').then(m => m.BookingsPage),
      },
      {
        path: 'bookings/:bookingId',
        loadComponent: () => import('./pages/bookings/booking-detail/booking-detail.page').then(m => m.BookingDetailPage),
      },
      {
        path: 'services',
        loadComponent: () => import('./pages/services/services.page').then(m => m.ServicesPage),
      },
      {
        path: '',
        redirectTo: '/a/dashboard',
        pathMatch: 'full',
      },
    ],
  },
];
