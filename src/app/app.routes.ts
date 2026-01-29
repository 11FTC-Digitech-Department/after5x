import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { initialRouteGuard } from './core/guards/initial-route-guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [initialRouteGuard],
    children: [], // Guard always redirects
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./domains/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  // Backwards compatibility redirects for old routes
  {
    path: 'customer',
    redirectTo: '/c',
    pathMatch: 'full',
  },
  {
    path: 'provider',
    redirectTo: '/p',
    pathMatch: 'full',
  },
  {
    path: 'admin',
    redirectTo: '/a',
    pathMatch: 'full',
  },
  {
    path: 'c', // Customer Shell
    canActivate: [authGuard],
    data: { role: 'customer' },
    loadChildren: () => import('./domains/customer/customer.routes').then(m => m.CUSTOMER_ROUTES),
  },
  {
    path: 'p', // Provider Shell
    canActivate: [authGuard],
    data: { role: 'provider' },
    loadChildren: () => import('./domains/provider/provider.routes').then(m => m.PROVIDER_ROUTES),
  },
  {
    path: 'a', // Admin Shell
    canActivate: [authGuard],
    data: { role: 'admin' },
    loadChildren: () => import('./domains/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  {
    path: 'chat', // Shared Chat Module
    canActivate: [authGuard],
    loadComponent: () => import('./domains/shared/pages/chat-room/chat-room.page').then(m => m.ChatRoomPage),
  },
  {
    path: 'provider-application', // Provider Application Form (public)
    loadComponent: () => import('./domains/provider/pages/application-form/application-form.page').then(m => m.ProviderApplicationFormPage),
  },
];