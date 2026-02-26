import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { devError } from '../utils/logger';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        devError('[HTTP] Network error:', req.url);
      } else if (error.status === 401) {
        devError('[HTTP] Unauthorized:', req.url);
        router.navigate(['/auth/login']);
      } else if (error.status >= 500) {
        devError('[HTTP] Server error:', error.status, req.url);
      }

      return throwError(() => error);
    })
  );
};
