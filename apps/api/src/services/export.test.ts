import { describe, it, expect, vi } from 'vitest';
import { fetchBlockedFeed, fetchDailyExport, renderRssFeed } from './export.js';
import type { D1Database } from '@cloudflare/workers-types';

function mockDb(rows: unknown[] = []) {
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: rows }),
      run: vi.fn().mockResolvedValue({ changes: 1 }),
      first: vi.fn().mockResolvedValue(null),
      bind: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: rows }), run: vi.fn().mockResolvedValue({ changes: 1 }), first: vi.fn().mockResolvedValue(null) }),
    }),
    batch: vi.fn(),
    exec: vi.fn(),
    withSession: vi.fn(),
    dump: vi.fn(),
  } as unknown as D1Database;
}

describe('renderRssFeed', () => {
  it('produces valid RSS with entries', () => {
    const entries = [
      { domain: 'github.com', status: 'blocked', block_reason: 'dns_poisoning', created_at: '2026-01-01T12:00:00Z', isp: 'tt' },
    ];
    const xml = renderRssFeed(entries);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<title>');
    expect(xml).toContain('github.com');
    expect(xml).toContain('dns_poisoning');
  });

  it('XML-escapes dangerous characters', () => {
    const entries = [
      { domain: 'evil.com', status: 'blocked', block_reason: '<script>alert(1)</script>', created_at: '2026-01-01T00:00:00Z' },
    ];
    const xml = renderRssFeed(entries);
    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;');
  });

  it('returns empty feed when no entries', () => {
    const xml = renderRssFeed([]);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).not.toContain('<item>');
  });
});

describe('fetchBlockedFeed (mocked)', () => {
  it('returns recent blocked measurements', async () => {
    const rows = [
      { domain: 'example.com', status: 'blocked', block_reason: 'dns_poisoning', created_at: '2026-01-01T10:00:00Z', isp: 'tt' },
    ];
    const db = mockDb(rows);
    const result = await fetchBlockedFeed(db);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe('example.com');
  });
});

describe('fetchDailyExport (mocked)', () => {
  it('returns measurements from last 24h', async () => {
    const rows = [
      { domain: 'test.com', source: 'browser', asn: 9121, isp: 'tt', status: 'up', block_reason: null, latency_ms: 50, created_at: '2026-01-01T10:00:00Z' },
    ];
    const db = mockDb(rows);
    const result = await fetchDailyExport(db);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('browser');
  });
});
