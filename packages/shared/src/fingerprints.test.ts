import { describe, it, expect } from 'vitest';
import { detectDNSPoisoning, detectBlockPage } from './fingerprints.js';

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
