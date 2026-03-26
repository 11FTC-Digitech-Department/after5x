import { Injectable } from '@angular/core';

export interface ErrorContextSnapshot {
  lastAction?: string;
  lastInvoke?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ErrorContextService {
  private lastAction?: string;
  private lastInvoke?: string;

  setLastAction(action: string): void {
    this.lastAction = action;
  }

  setLastInvoke(invokeName: string): void {
    this.lastInvoke = invokeName;
  }

  getSnapshot(): ErrorContextSnapshot {
    return {
      lastAction: this.lastAction,
      lastInvoke: this.lastInvoke,
    };
  }
}
