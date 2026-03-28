import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then(m => m.Landing),
  },
  {
    path: 'room/:roomId',
    loadComponent: () => import('./pages/room/room').then(m => m.Room),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
