import { environment } from '../../../environments/environment';

export function devLog(message: string, ...args: any[]) {
  if (!environment.production) {
    console.log(message, ...args);
  }
}

export function devWarn(message: string, ...args: any[]) {
  if (!environment.production) {
    console.warn(message, ...args);
  }
}

export function devError(message: string, ...args: any[]) {
  if (!environment.production) {
    console.error(message, ...args);
  }
}
