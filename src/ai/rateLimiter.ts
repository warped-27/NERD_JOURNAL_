export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private timestamps: number[] = [];

  constructor(private opts: RateLimiterOptions) {}

  tryAcquire(): boolean {
    const now = Date.now();
    const cutoff = now - this.opts.windowMs;

    // Evict entries outside the window
    this.timestamps = this.timestamps.filter((t) => t > cutoff);

    if (this.timestamps.length >= this.opts.maxRequests) return false;

    this.timestamps.push(now);
    return true;
  }

  remaining(): number {
    const now = Date.now();
    const cutoff = now - this.opts.windowMs;
    const active = this.timestamps.filter((t) => t > cutoff).length;
    return Math.max(0, this.opts.maxRequests - active);
  }

  reset(): void {
    this.timestamps = [];
  }
}

export const DEFAULT_RATE_LIMITER = new RateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
});
