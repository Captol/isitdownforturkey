import { describe, it, expect } from 'vitest';
import { buildCheckResponse } from './aggregation.js';

describe('buildCheckResponse', () => {
  const baseline = {
    domain: 'example.com', dnsResolved: true, httpsReachable: true,
    httpStatus: 200, latencyMs: 45,
    timestamp: new Date().toISOString(),
  };

  it('returns UP when all probes agree', () => {
    const probes = {
      'turk-telekom': [{
        domain: 'example.com', isp: 'turk-telekom' as const, asn: 9121,
        tcpConnected: true, tlsSucceeded: true, httpStatus: 200,
        latencyMs: 120, timestamp: new Date().toISOString(),
      }],
    };
    const r = buildCheckResponse({ domain: 'example.com', globalBaseline: baseline, ispProbes: probes });
    expect(r.verdict).toBe('UP');
  });

  it('returns DOWN_GLOBALLY when global baseline is down', () => {
    const downBaseline = { ...baseline, httpsReachable: false };
    const r = buildCheckResponse({ domain: 'down.example', globalBaseline: downBaseline, ispProbes: {} });
    expect(r.verdict).toBe('DOWN_GLOBALLY');
  });

  it('returns UNKNOWN when global baseline is up but no Turkish probes exist', () => {
    // Global baseline runs from outside Turkey — cannot confirm Turkey reachability
    const r = buildCheckResponse({ domain: 'no-data.example', globalBaseline: baseline, ispProbes: {} });
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.confidence).toBe('none');
  });

  it('returns UP with global baseline when probes exist and agree', () => {
    const probes = {
      'turk-telekom': [{
        domain: 'example.com', isp: 'turk-telekom' as const, asn: 9121,
        tcpConnected: true, tlsSucceeded: true, httpStatus: 200,
        latencyMs: 120, timestamp: new Date().toISOString(),
      }],
    };
    const r = buildCheckResponse({ domain: 'example.com', globalBaseline: baseline, ispProbes: probes });
    expect(r.verdict).toBe('UP');
  });
});
