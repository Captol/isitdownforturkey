import { describe, it, expect } from 'vitest';
import { validateDomain, normalizeDomain } from './ssrf.js';

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
