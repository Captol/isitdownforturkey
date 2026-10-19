import { describe, it, expect } from 'vitest';
import { normalizeDomain, validateDomain } from './ssrf.js';
import { detectDNSPoisoning, detectBlockPage } from './fingerprints.js';
import { buildCheckResponse } from './aggregation.js';

describe('normalizeDomain', () => {
  it('strips https://, http://, ports, www., trailing dots', () => {
    expect(normalizeDomain('https://example.com/')).toBe('example.com');
    expect(normalizeDomain('http://www.google.com:443')).toBe('google.com');
    expect(normalizeDomain('https://example.com.')).toBe('example.com');
  });

  it('lowercases input', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
  });
});

describe('validateDomain SSRF guard', () => {
  it('allows public domains', () => {
    expect(validateDomain('google.com')).toBe(true);
    expect(validateDomain('openai.com')).toBe(true);
    expect(validateDomain('github.com')).toBe(true);
    expect(validateDomain('turkiye.gov.tr')).toBe(true);
  });

  it('rejects loopback and localhost', () => {
    expect(validateDomain('localhost')).toBe(false);
    expect(validateDomain('127.0.0.1')).toBe(false);
    expect(validateDomain('::1')).toBe(false);
  });

  it('rejects RFC 1918 private IPv4 ranges', () => {
    expect(validateDomain('10.0.0.1')).toBe(false);
    expect(validateDomain('172.16.0.1')).toBe(false);
    expect(validateDomain('192.168.1.1')).toBe(false);
  });

  it('rejects cloud metadata IPs', () => {
    expect(validateDomain('169.254.169.254')).toBe(false);
    expect(validateDomain('metadata.google.internal')).toBe(false);
  });

  it('rejects invalid/syntax-bad domains', () => {
    expect(validateDomain('')).toBe(false);
    expect(validateDomain('not-a-domain')).toBe(false);
    expect(validateDomain('-bad.com')).toBe(false);
  });
});

describe('detectDNSPoisoning', () => {
  it('detects sinkhole IPs in system DNS', () => {
    expect(detectDNSPoisoning({
      systemDns: ['195.175.10.10'],
      dohCloudflare: ['93.184.216.34'],
    })).toBe('dns_poisoning');
  });

  it('returns null when DNS matches', () => {
    expect(detectDNSPoisoning({
      systemDns: ['93.184.216.34'],
      dohCloudflare: ['93.184.216.34'],
    })).toBeNull();
  });

  it('returns null with no data', () => {
    expect(detectDNSPoisoning({})).toBeNull();
  });
});

describe('detectBlockPage', () => {
  it('detects BTK title pattern', () => {
    expect(detectBlockPage({ htmlTitle: '5651 Sayılı Kanun Kapsamında' })).toBe('http_block_page');
  });

  it('returns null for normal titles', () => {
    expect(detectBlockPage({ htmlTitle: 'OpenAI' })).toBeNull();
  });
});

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
    const r = buildCheckResponse({ domain: 'no-data.example', globalBaseline: baseline, ispProbes: {} });
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.confidence).toBe('none');
  });
});
