import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { SessionService } from '../auth/session';
import { ConfigService } from '../config/config.service';
import { ErrorContextService } from './error-context.service';
import { SupabaseService } from '../supabase/supabase';
import { devError } from '../utils/logger';
import { environment } from '../../../environments/environment';

export interface ClientErrorReportPayload {
  message: string;
  stack?: string;
  route?: string;
  platform?: string;
  userId?: string;
  environment: string;
  lastAction?: string;
  lastInvoke?: string;
  timestamp: string;
  source: 'global' | 'http';
}

@Injectable({
  providedIn: 'root',
})
export class ErrorReportingService {
  private readonly configService = inject(ConfigService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly sessionService = inject(SessionService);
  private readonly errorContextService = inject(ErrorContextService);
  private readonly router = inject(Router);

  async reportError(
    source: ClientErrorReportPayload['source'],
    error: unknown,
    overrides: Partial<Omit<ClientErrorReportPayload, 'source' | 'timestamp'>> = {}
  ): Promise<void> {
    if (!this.configService.errorReporting.enabled) {
      return;
    }

    try {
      const payload = this.buildPayload(source, error, overrides);
      const { error: invokeError } = await this.supabaseService.client.functions.invoke('report-client-error', {
        body: payload,
      });

      if (invokeError) {
        devError('[ErrorReporting] Failed to send error report:', invokeError);
      }
    } catch (reportingError) {
      devError('[ErrorReporting] Unexpected reporting failure:', reportingError);
    }
  }

  private buildPayload(
    source: ClientErrorReportPayload['source'],
    error: unknown,
    overrides: Partial<Omit<ClientErrorReportPayload, 'source' | 'timestamp'>>
  ): ClientErrorReportPayload {
    const normalizedError = this.normalizeError(error);
    const userId = this.sessionService.profile()?.id ?? this.sessionService.session()?.user?.id ?? undefined;
    const context = this.errorContextService.getSnapshot();

    return {
      message: overrides.message ?? normalizedError.message,
      stack: overrides.stack ?? normalizedError.stack,
      route: overrides.route ?? this.router.url,
      platform: overrides.platform ?? this.getPlatformLabel(),
      userId: overrides.userId ?? userId,
      environment: this.getEnvironmentLabel(),
      lastAction: overrides.lastAction ?? context.lastAction,
      lastInvoke: overrides.lastInvoke ?? context.lastInvoke,
      timestamp: new Date().toISOString(),
      source,
    };
  }

  private normalizeError(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
      return {
        message: error.message || error.name || 'Unknown error',
        stack: error.stack,
      };
    }

    if (typeof error === 'string') {
      return { message: error };
    }

    if (typeof error === 'object' && error !== null) {
      const record = error as Record<string, unknown>;
      const message = typeof record['message'] === 'string'
        ? record['message']
        : typeof record['error'] === 'string'
          ? record['error']
          : 'Unknown error';
      const stack = typeof record['stack'] === 'string' ? record['stack'] : undefined;
      return { message, stack };
    }

    return { message: 'Unknown error' };
  }

  private getPlatformLabel(): string {
    const platform = Capacitor.getPlatform();
    return Capacitor.isNativePlatform() ? `native:${platform}` : `web:${platform}`;
  }

  private getEnvironmentLabel(): string {
    return environment.production ? 'production' : 'local';
  }
}
