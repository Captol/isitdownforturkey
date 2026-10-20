/**
 * HMAC verification for probe reports — server-side validation.
 *
 * Called by: apps/api/src/index.ts (POST /api/probes/report route)
 * No existing file serves this purpose; the current API stub skips signing.
 *
 * Reads: probe report JSON (domain, asn, dns results, etc.) + HMAC token from env
 * Writes: boolean (signature valid?) + RateLimiter state (in-memory Map)
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify an HMAC-SHA256 signature on a probe report.
 * Returns true if the signature matches the expected token.
 */
export function verifyProbeSignature(
  token: string,
  report: Record<string, unknown>,
  signature: string,
): boolean {
  // Remove signature from report before signing for comparison
  const { signature: _sig, ...payload } = report;
  // Sort keys to match Python json.dumps(sort_keys=True) — key order affects HMAC
  const expected = createHmac('sha256', token)
    .update(JSON.stringify(payload, Object.keys(payload).sort()))
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const sigBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== sigBuf.length) return false;
  return timingSafeEqual(expectedBuf, sigBuf);
}

/**
 * Rate-limit tracker using an in-memory Map.
 * In production, replace with a Redis/KV-backed limiter.
 */
export class RateLimiter {
  private readonly checks = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxChecks: number;

  constructor(windowMs = 60_000, maxChecks = 60) {
    this.windowMs = windowMs;
    this.maxChecks = maxChecks;
  }

  /** Check if a key (probeId) has exceeded the rate limit. */
  check(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.checks.get(key) ?? [];
    const recent = timestamps.filter(t => t > windowStart);

    if (recent.length >= this.maxChecks) return false; // rate limited

    recent.push(now);
    this.checks.set(key, recent);
    return true;
  }

  /** Clean up old entries. Call periodically. */
  prune(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.checks) {
      const recent = timestamps.filter(t => t > windowStart);
      if (recent.length === 0) {
        this.checks.delete(key);
      } else {
        this.checks.set(key, recent);
      }
    }
  }
}

export const probeSecurityExports = { verifyProbeSignature, RateLimiter };
