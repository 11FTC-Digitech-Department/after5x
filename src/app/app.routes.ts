import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/welcome',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () => import('./domains/auth/auth.routes').then(m => m.AUTH_ROUTES),
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
    path: 'chat', // Shared Chat Module
    canActivate: [authGuard],
    loadComponent: () => import('./domains/shared/pages/chat-room/chat-room.page').then(m => m.ChatRoomPage),
  },
];