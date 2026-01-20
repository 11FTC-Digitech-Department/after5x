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
  // Profile sub-pages
  {
    path: 'profile/edit',
    loadComponent: () => import('./pages/profile/edit-profile/edit-profile.page').then(m => m.EditProfilePage),
  },
  {
    path: 'profile/business',
    loadComponent: () => import('./pages/profile/business-profile/business-profile.page').then(m => m.BusinessProfilePage),
  },
  {
    path: 'profile/addresses',
    loadComponent: () => import('./pages/profile/addresses/addresses.page').then(m => m.AddressesPage),
  },
  {
    path: 'profile/service-settings',
    loadComponent: () => import('./pages/profile/service-settings/service-settings.page').then(m => m.ServiceSettingsPage),
  },
  {
    path: 'profile/documents',
    loadComponent: () => import('./pages/profile/documents/documents.page').then(m => m.DocumentsPage),
  },
  {
    path: 'profile/bank-settings',
    loadComponent: () => import('./pages/profile/bank-settings/bank-settings.page').then(m => m.BankSettingsPage),
  },
  {
    path: 'profile/notifications',
    loadComponent: () => import('./pages/profile/notification-settings/notification-settings.page').then(m => m.NotificationSettingsPage),
  },
  {
    path: 'profile/support',
    loadComponent: () => import('./pages/profile/support/support.page').then(m => m.SupportPage),
  },
  {
    path: 'profile/about',
    loadComponent: () => import('./pages/profile/about/about.page').then(m => m.AboutPage),
  },
  // Legal pages
  {
    path: 'privacy',
    loadComponent: () => import('./pages/privacy/privacy.page').then(m => m.PrivacyPage),
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/terms/terms.page').then(m => m.TermsPage),
  },
];
