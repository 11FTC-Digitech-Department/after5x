import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ErrorReportingService } from '../services/error-reporting.service';
import { devError } from '../utils/logger';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const errorReporting = inject(ErrorReportingService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        devError('[HTTP] Network error:', req.url);
        void errorReporting.reportError('http', error, {
          message: `Network error: ${req.method} ${req.url}`,
          stack: error.message,
        });
      } else if (error.status === 401) {
        devError('[HTTP] Unauthorized:', req.url);
        router.navigate(['/auth/login']);
      } else if (error.status >= 500) {
        devError('[HTTP] Server error:', error.status, req.url);
        void errorReporting.reportError('http', error, {
          message: `HTTP ${error.status}: ${req.method} ${req.url}`,
          stack: error.message,
        });
      }

      return throwError(() => error);
    })
  );
};
