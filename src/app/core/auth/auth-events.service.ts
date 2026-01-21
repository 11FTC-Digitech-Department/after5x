import { Injectable, signal, computed } from '@angular/core';

export type AuthEventType = 'SESSION_STARTED' | 'SESSION_REFRESHED' | 'SESSION_EXPIRED' | 'SIGNED_OUT';

export interface AuthEvent {
  type: AuthEventType;
  userId?: string;
  timestamp: Date;
}

/**
 * Auth Events Service
 * Provides a signal-based event bus for auth state changes.
 * Other services can listen to these events to react accordingly
 * (e.g., cleanup realtime subscriptions on logout).
 */
@Injectable({ providedIn: 'root' })
export class AuthEventsService {
  private _lastEvent = signal<AuthEvent | null>(null);
  private _eventCounter = signal(0);

  /** The most recent auth event */
  readonly lastEvent = this._lastEvent.asReadonly();

  /**
   * Combined trigger for effects that need to react to auth events.
   * The counter ensures effects fire even for identical event types.
   */
  readonly eventTrigger = computed(() => ({
    event: this._lastEvent(),
    count: this._eventCounter()
  }));

  /**
   * Emit an auth event to all listeners
   */
  emit(type: AuthEventType, userId?: string): void {
    const event: AuthEvent = {
      type,
      userId,
      timestamp: new Date()
    };
    this._lastEvent.set(event);
    this._eventCounter.update(c => c + 1);
    console.log(`AuthEventsService: Emitted ${type}`, userId ? `for user ${userId}` : '');
  }

  /**
   * Check if the last event was a logout/expiry event
   */
  wasLoggedOut(): boolean {
    const event = this._lastEvent();
    return event?.type === 'SIGNED_OUT' || event?.type === 'SESSION_EXPIRED';
  }
}
