import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

interface Bucket {
  failures: number[];
  blockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

/**
 * Brute-force protection for admin login. Only FAILED attempts are counted;
 * a successful login clears the account's counter.
 */
@Injectable()
export class LoginThrottleService {
  private readonly buckets = new Map<string, Bucket>();

  /** Throws 429 if this email or IP is currently blocked. Call before checking the password. */
  assertAllowed(email: string, ip: string) {
    const now = Date.now();
    const blockedUntil = Math.max(
      this.buckets.get(this.emailKey(email))?.blockedUntil ?? 0,
      this.buckets.get(this.ipKey(ip))?.blockedUntil ?? 0,
    );
    if (blockedUntil > now) {
      const minutes = Math.ceil((blockedUntil - now) / 60000);
      throw new HttpException(
        `Too many failed login attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'} or reset your password.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(email: string, ip: string) {
    this.hit(this.emailKey(email), MAX_FAILURES_PER_EMAIL);
    this.hit(this.ipKey(ip), MAX_FAILURES_PER_IP);
  }

  recordSuccess(email: string) {
    this.buckets.delete(this.emailKey(email));
  }

  private hit(key: string, max: number) {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { failures: [], blockedUntil: 0 };
    bucket.failures = bucket.failures.filter((t) => now - t < WINDOW_MS);
    bucket.failures.push(now);
    if (bucket.failures.length >= max) {
      bucket.blockedUntil = now + BLOCK_MS;
      bucket.failures = [];
    }
    this.buckets.set(key, bucket);
  }

  private emailKey(email: string) {
    return `email:${(email || '').trim().toLowerCase()}`;
  }

  private ipKey(ip: string) {
    return `ip:${ip}`;
  }

  /** Drop expired buckets so memory stays bounded. */
  @Cron('*/15 * * * *', { name: 'login-throttle-prune' })
  prune() {
    const now = Date.now();
    for (const [key, b] of this.buckets) {
      const recent = b.failures.some((t) => now - t < WINDOW_MS);
      if (!recent && b.blockedUntil <= now) this.buckets.delete(key);
    }
  }
}
