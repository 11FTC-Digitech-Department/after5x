import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PaymentContextService {
  private _isInPaymentFlow = signal(false);
  readonly isInPaymentFlow = this._isInPaymentFlow.asReadonly();

  enterPaymentFlow(): void {
    this._isInPaymentFlow.set(true);
  }

  exitPaymentFlow(): void {
    this._isInPaymentFlow.set(false);
  }
}
