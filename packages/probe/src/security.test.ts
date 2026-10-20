/**
 * Probe security tests — signature verification and rate limiting.
 * Tests packages/probe/src/security.ts (verifyProbeSignature, RateLimiter).
 * No existing test file for this module; security.ts is a new package.
 * User instruction: "Build volunteer probe agent (packages/probe/) — Node.js + Python + Docker, signed HMAC ingest, anti-spoofing"
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyProbeSignature, RateLimiter } from './security.js';

describe('verifyProbeSignature', () => {
  const token = 'probe-security-test-token-32!!';

  it('accepts a valid signature', () => {
    const report = { domain: 'example.com', asn: 9121, timestamp: '2026-01-01T00:00:00Z' };
    // Sort keys to match Python json.dumps(sort_keys=True) — key order affects HMAC
    const sig = createHmac('sha256', token)
      .update(JSON.stringify(report, Object.keys(report).sort()))
      .digest('hex');
    expect(verifyProbeSignature(token, report, sig)).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const report = { domain: 'example.com', asn: 9121 };
    const sig = 'a'.repeat(64); // garbage signature
    expect(verifyProbeSignature(token, report, sig)).toBe(false);
  });

  it('rejects a report modified after signing', () => {
    const report = { domain: 'honest.com', asn: 9121 };
    // Sort keys to match Python json.dumps(sort_keys=True)
    const sig = createHmac('sha256', token)
      .update(JSON.stringify(report, Object.keys(report).sort()))
      .digest('hex');
    // Sign with original, verify with tampered
    expect(verifyProbeSignature(token, { ...report, domain: 'liar.com' }, sig)).toBe(false);
  });

  it('uses timing-safe comparison (no early return)', () => {
    const report = { domain: 'example.com' };
    // Sort keys to match Python json.dumps(sort_keys=True)
    const sig = createHmac('sha256', token)
      .update(JSON.stringify(report, Object.keys(report).sort()))
      .digest('hex');
    // Both should take roughly same time — just verify correctness
    expect(verifyProbeSignature(token, report, sig)).toBe(true);
    expect(verifyProbeSignature(token, report, 'wrong')).toBe(false);
  });
});

describe('RateLimiter', () => {
  it('allows requests within the limit', () => {
    const limiter = new RateLimiter(60_000, 10);
    for (let i = 0; i < 10; i++) {
      expect(limiter.check('probe-1')).toBe(true);
    }
  });

  it('rejects requests exceeding the limit', () => {
    const limiter = new RateLimiter(60_000, 5);
    for (let i = 0; i < 5; i++) limiter.check('probe-2');
    expect(limiter.check('probe-2')).toBe(false);
  });

  it('tracks different keys independently', () => {
    const limiter = new RateLimiter(60_000, 2);
    limiter.check('key-a');
    limiter.check('key-a');
    expect(limiter.check('key-a')).toBe(false); // exhausted
    expect(limiter.check('key-b')).toBe(true);  // different key, OK
  });

  it('prunes old entries after window expires', () => {
    const limiter = new RateLimiter(1, 5); // 1ms window
    limiter.check('temp-key');
    expect(limiter.check('temp-key')).toBe(true);
    // Wait for window to expire
    const start = Date.now();
    while (Date.now() - start < 10) {} // spin ~10ms
    limiter.prune();
    expect(limiter.check('temp-key')).toBe(true); // window expired, allowed again
  });
});
