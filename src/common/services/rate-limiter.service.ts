import { Injectable } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimiterService {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly windowMs = 10_000; // 10 seconds
  private readonly maxRequests = 5;

  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  secondsUntilReset(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;
    return Math.ceil((entry.resetAt - Date.now()) / 1000);
  }
}
