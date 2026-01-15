import { Routes } from '@angular/router';
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
        path: 'activity',
        loadComponent: () => import('./pages/activity/activity.page').then(m => m.ActivityPage),
      },
      {
        path: 'messages',
        loadComponent: () => import('./pages/messages/messages.page').then(m => m.MessagesPage), // You might need to generate this if you haven't
      },
      {
        path: 'profile',
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
    path: 'catalog/:catId',
    loadComponent: () => import('./pages/catalog/catalog.page').then(m => m.CatalogPage),
  },
  {
    path: 'book/:id',
    loadComponent: () => import('./pages/booking-form/booking-form.page').then(m => m.BookingFormPage),
  },
  {
    path: 'profile/addresses',
    loadComponent: () => import('./pages/profile/addresses/addresses.page').then(m => m.AddressesPage),
  },
  {
    path: 'service-details/:serviceVariantId',
    loadComponent: () => import('./pages/service-details/service-details.page').then(m => m.ServiceDetailsPage),
  },
  {
    path: 'address-selector',
    loadComponent: () => import('./pages/address-selector/address-selector.page').then(m => m.AddressSelectorPage),
  },
];