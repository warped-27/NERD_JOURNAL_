import { RateLimiter } from '../rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('allows requests within the limit', () => {
    const rl = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(true);
  });

  it('blocks requests over the limit', () => {
    const rl = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(false);
  });

  it('allows again after window expires', () => {
    const rl = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });
    rl.tryAcquire();
    rl.tryAcquire();
    expect(rl.tryAcquire()).toBe(false);

    jest.advanceTimersByTime(60_001);
    expect(rl.tryAcquire()).toBe(true);
  });

  it('uses sliding window (old timestamps expire individually)', () => {
    const rl = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });
    rl.tryAcquire();                      // t=0
    jest.advanceTimersByTime(30_000);
    rl.tryAcquire();                      // t=30s
    expect(rl.tryAcquire()).toBe(false);  // still 2 in window

    jest.advanceTimersByTime(30_001);     // t=60s → first entry expired
    expect(rl.tryAcquire()).toBe(true);   // only 1 in window
  });

  it('reset() clears all timestamps', () => {
    const rl = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });
    rl.tryAcquire();
    expect(rl.tryAcquire()).toBe(false);
    rl.reset();
    expect(rl.tryAcquire()).toBe(true);
  });

  it('remaining() reports correct count', () => {
    const rl = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    expect(rl.remaining()).toBe(5);
    rl.tryAcquire();
    rl.tryAcquire();
    expect(rl.remaining()).toBe(3);
  });
});
