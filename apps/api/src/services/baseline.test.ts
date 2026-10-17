import { describe, it, expect, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { runBaselineCheck, toGlobalBaseline, upsertDomain, storeBaselineMeasurement } from './baseline.js';

// Mock fetch for all DoH and HTTPS calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('performance', { now: () => 1000 });

describe('runBaselineCheck', () => {
  it('returns DNS records from both resolvers and HTTPS status', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Answer: [{ data: '93.184.216.34' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Answer: [{ data: '93.184.216.34' }] }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
      });

    const result = await runBaselineCheck('example.com');
    expect(result.dnsResolved).toBe(true);
    expect(result.cfDnsRecords).toEqual(['93.184.216.34']);
    expect(result.googleDnsRecords).toEqual(['93.184.216.34']);
    expect(result.httpsReachable).toBe(true);
    expect(result.httpStatus).toBe(200);
  });

  it('handles resolver failures gracefully', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'));

    const result = await runBaselineCheck('broken.example');
    expect(result.dnsResolved).toBe(false);
    expect(result.httpsReachable).toBe(false);
    expect(result.cfDnsRecords).toEqual([]);
    expect(result.googleDnsRecords).toEqual([]);
  });

  it('handles HTTPS 404 as not reachable', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Answer: [{ data: '1.2.3.4' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Answer: [{ data: '1.2.3.4' }] }),
      })
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
      });

    const result = await runBaselineCheck('missing.example');
    expect(result.httpsReachable).toBe(false);
    expect(result.httpStatus).toBe(404);
  });
});

describe('toGlobalBaseline', () => {
  it('maps BaselineResult to GlobalBaseline', () => {
    const input = {
      domain: 'example.com',
      dnsResolved: true,
      cfDnsRecords: ['1.2.3.4'],
      googleDnsRecords: ['1.2.3.4'],
      httpsReachable: true,
      httpStatus: 200,
      latencyMs: 50,
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const result = toGlobalBaseline(input);
    expect(result).toEqual(input);
  });
});

describe('D1 helpers (mocked)', () => {
  it('upsertDomain inserts and returns id', async () => {
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(undefined),
          first: vi.fn().mockResolvedValue({ id: 42 }),
        }),
      })),
      batch: vi.fn(),
      exec: vi.fn(),
      withSession: vi.fn(),
      dump: vi.fn(),
    } as unknown as D1Database;
    const id = await upsertDomain(mockDb, 'test.com');
    expect(id).toBe(42);
  });

  it('storeBaselineMeasurement inserts a row', async () => {
    const runMock = vi.fn().mockResolvedValue(undefined);
    const mockDb = {
      prepare: vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({ run: runMock }),
      })),
      batch: vi.fn(),
      exec: vi.fn(),
      withSession: vi.fn(),
      dump: vi.fn(),
    } as unknown as D1Database;
    await storeBaselineMeasurement(mockDb, 1, {
      domain: 'test.com',
      dnsResolved: true,
      cfDnsRecords: [],
      googleDnsRecords: [],
      httpsReachable: true,
      httpStatus: 200,
      latencyMs: 30,
      timestamp: new Date().toISOString(),
    });
    expect(runMock).toHaveBeenCalled();
  });
});
