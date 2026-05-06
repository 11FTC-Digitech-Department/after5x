import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth-guard';
import { CustomerTabsPage } from './customer-tabs/customer-tabs.page';

export const CUSTOMER_ROUTES: Routes = [
  {
    path: '',
    component: CustomerTabsPage,
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage),
      },
      {
        path: 'categories',
        loadComponent: () => import('./pages/categories/categories.page').then(m => m.CategoriesPage),
      },
      {
        path: 'bookings',
        canActivate: [authGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/bookings/bookings.page').then(m => m.BookingsPage),
          },
          {
            path: ':bookingId',
            canActivate: [authGuard],
            loadComponent: () => import('./pages/booking-details/booking-details.page').then(m => m.BookingDetailsPage),
          },
        ],
      },
      {
        path: 'messages',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/messages/messages.page').then(m => m.MessagesPage),
      },
      {
        path: 'notifications',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/notifications/notifications.page').then(m => m.NotificationsPage),
      },
      {
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage),
      },
      {
        path: '',
        redirectTo: '/c/home',
        pathMatch: 'full',
      },
    ],
  },
  // Full screen pages (outside tabs)
  {
    path: 'payment/:bookingId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/payment/payment.page').then(m => m.PaymentPage),
  },
  {
    path: 'catalog/:catId',
    loadComponent: () => import('./pages/catalog/catalog.page').then(m => m.CatalogPage),
  },
  {
    path: 'book/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/booking-form/booking-form.page').then(m => m.BookingFormPage),
  },
  {
    path: 'service-details/:serviceVariantId',
    loadComponent: () => import('./pages/service-details/service-details.page').then(m => m.ServiceDetailsPage),
  },
  {
    path: 'address-selector',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/address-selector/address-selector.page').then(m => m.AddressSelectorPage),
  },
  // Profile sub-pages
  {
    path: 'profile/edit',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/edit-profile/edit-profile.page').then(m => m.EditProfilePage),
  },
  {
    path: 'profile/addresses',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/addresses/addresses.page').then(m => m.AddressesPage),
  },
  {
    path: 'profile/payment-methods',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/payment-methods/payment-methods.page').then(m => m.PaymentMethodsPage),
  },
  {
    path: 'profile/notifications',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/notification-settings/notification-settings.page').then(m => m.NotificationSettingsPage),
  },
  {
    path: 'profile/support',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/support/support.page').then(m => m.SupportPage),
  },
  {
    path: 'chat/:bookingId',
    canActivate: [authGuard],
    loadComponent: () => import('../shared/pages/chat-room/chat-room.page').then(m => m.ChatRoomPage),
  },
  {
    path: 'profile/about',
    canActivate: [authGuard],
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
