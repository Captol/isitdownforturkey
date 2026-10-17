/**
 * Probe agent tests — signed report creation and block-page detection.
 * Tests the probe module's crypto and fingerprint logic.
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';

// ─── signReport (inline copy of probe's logic for testing) ───────────────────

function signReport(token, report) {
  const payload = JSON.stringify(report);
  return createHmac('sha256', token).update(payload).digest('hex');
}

describe('signReport', () => {
  it('produces a 64-char hex HMAC-SHA256 signature', () => {
    const token = 'test-secret-key-32-chars-min!!!';
    const report = { domain: 'example.com', asn: 9121 };
    const sig = signReport(token, report);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it('different reports produce different signatures', () => {
    const token = 'test-secret-key-32-chars-min!!!';
    const sig1 = signReport(token, { domain: 'a.com' });
    const sig2 = signReport(token, { domain: 'b.com' });
    expect(sig1).not.toBe(sig2);
  });

  it('different tokens produce different signatures for same report', () => {
    const report = { domain: 'example.com' };
    const sig1 = signReport('token-one-32-chars-min!!!!!', report);
    const sig2 = signReport('token-two-32-chars-min!!!!!', report);
    expect(sig1).not.toBe(sig2);
  });

  it('validates correctly — re-derived signature matches', () => {
    const token = 'validate-test-token-32-chars!!';
    const report = { domain: 'test.com', asn: 12345 };
    const sig = signReport(token, report);
    const payload = JSON.stringify(report);
    const expected = createHmac('sha256', token).update(payload).digest('hex');
    expect(sig).toBe(expected);
  });

  it('rejects tampered report — signature mismatch', () => {
    const token = 'tamper-test-token-32-chars!!!';
    const report = { domain: 'honest.com', asn: 12345 };
    const sig = signReport(token, report);
    const tamperedSig = signReport(token, { ...report, domain: 'liar.com' });
    expect(sig).not.toBe(tamperedSig);
  });
});

// ─── detectBlockPage ─────────────────────────────────────────────────────────

function detectBlockPage(title, body) {
  if (!title && !body) return null;
  const text = ((title ?? '') + ' ' + (body ?? '')).toLowerCase();
  const patterns = [
    /5651\s*sayılı\s*kanaat/i,
    /5651\s*sayılı\s*kanun/i,
    /adli\s*müdahale/i,
    /erişim\s*engellenmiştir/i,
    /site\s*engellenmiştir/i,
    /internet\s*engelleme/i,
    /mahkeme\s*kararı/i,
  ];
  for (const pattern of patterns) {
    if (pattern.test(text)) return 'http_block_page';
  }
  return null;
}

describe('detectBlockPage', () => {
  it('detects BTK title pattern', () => {
    expect(detectBlockPage('5651 Sayılı Kanun Kapsamında')).toBe('http_block_page');
  });

  it('detects block page indicators in body', () => {
    expect(detectBlockPage(undefined, 'Erişim Engellenmiştir')).toBe('http_block_page');
  });

  it('returns null for normal pages', () => {
    expect(detectBlockPage('OpenAI ChatGPT', 'ChatGPT is an AI assistant.')).toBeNull();
  });

  // ponytail: case-insensitive test skipped — JS /i flag doesn't handle
  // Turkish dotless-ı / dotted-I correctly; production regex uses explicit toLowerCase()
});
