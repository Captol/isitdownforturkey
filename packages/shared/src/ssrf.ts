/**
 * SSRF protection and domain normalization utilities.
 *
 * Validates all incoming target domains before any network probe is executed.
 */

import { z } from 'zod';

// ─── IP Validation ───────────────────────────────────────────────────────────

const PRIVATE_IPV4_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },       // 10.0.0.0/8
  { start: '172.16.0.0', end: '172.31.255.255' },      // 172.16.0.0/12
  { start: '192.168.0.0', end: '192.168.255.255' },    // 192.168.0.0/16
  { start: '127.0.0.0', end: '127.255.255.255' },      // 127.0.0.0/8 (loopback)
];

const PRIVATE_IPV6_RANGES = [
  'fc00::',       // Unique local (ULA)
  '::1',          // Loopback
  'fe80::',       // Link-local
  '169.254.0.0',  // Link-local IPv4 (APIPA)
];

const CLOUD_METADATA_ENDPOINTS = [
  'metadata.google.internal',
  '169.254.169.254',
  '100.100.100.200',  // Aliyun
  '168.63.129.16',    // Azure
];

/**
 * Parse an IPv4 address into a 32-bit integer for range comparison.
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.some(isNaN)) return -1;
  return (
    ((parts[0]! << 24) >>> 0) +
    ((parts[1]! << 16) >>> 0) +
    (parts[2]! << 8) +
    parts[3]!
  );
}

/**
 * Check if an IP address falls within a private or reserved range.
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 range check
  const ipNum = ipToNumber(ip);
  if (ipNum >= 0) {
    for (const range of PRIVATE_IPV4_RANGES) {
      if (ipNum >= ipToNumber(range.start) && ipNum <= ipToNumber(range.end)) {
        return true;
      }
    }
  }

  // Cloud metadata endpoints
  if (CLOUD_METADATA_ENDPOINTS.includes(ip)) return true;

  return false;
}

// ─── Domain Validation ───────────────────────────────────────────────────────

/**
 * Normalize a domain string for consistent lookups.
 * - Lowercases the domain
 * - Strips trailing dot
 * - Converts punycode to unicode (for display) or vice versa
 */
export function normalizeDomain(input: string): string {
  let domain = input.toLowerCase().trim();

  // Strip protocol
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^http:\/\//, '');

  // Strip www. prefix for consistency
  domain = domain.replace(/^www\./, '');

  // Remove trailing dot
  domain = domain.replace(/\.$/, '');

  // Strip port
  domain = domain.replace(/:\d+$/, '');

  // Convert to ASCII (punycode) for internationalized domain names
  try {
    return new URL(`https://${domain}`).hostname;
  } catch {
    return domain;
  }
}

/**
 * Validate that a domain is a public, reachable hostname.
 * Returns true if safe to probe, false if it's private/internal/malicious.
 */
export function validateDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain);

  // Reject empty or too long
  if (normalized.length < 1 || normalized.length > 253) return false;

  // Must have at least one dot (FQDN requirement)
  if (!normalized.includes('.')) return false;

  // Reject if it looks like an IP address
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return !isPrivateIP(normalized);
  }

  // Reject IPv6
  if (normalized.includes(':')) return false;

  // Reject localhost variants
  if (normalized === 'localhost' || normalized === 'local') return false;

  // Reject known internal/tunnel endpoints
  const blocked = [
    'metadata.google.internal',
    'metadata.internal',
    'instance-data',
    '169.254.169.254',
  ];
  if (blocked.some(b => normalized.includes(b))) return false;

  // Validate TLD length (2+ chars)
  const tld = normalized.split('.').pop();
  if (!tld || tld.length < 2) return false;

  // Must contain only valid hostname characters
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(normalized)) {
    return false;
  }

  return true;
}

// ─── SSRF Test Harness ──────────────────────────────────────────────────────

/**
 * Self-test for SSRF validation logic.
 * Run with: npx vitest run packages/shared/src/ssrf.test.ts
 */
export function runSSRFTests(): void {
  const tests = [
    // Should pass
    { domain: 'example.com', expected: true },
    { domain: 'https://example.com', expected: true },
    { domain: 'https://www.example.com:443', expected: true },
    { domain: 'github.com', expected: true },
    { domain: 'openai.com', expected: true },
    { domain: 'xn--e1afmkfd.xn--p1ai', expected: true }, // punycode

    // Should fail - private IPs
    { domain: '127.0.0.1', expected: false },
    { domain: '192.168.1.1', expected: false },
    { domain: '10.0.0.1', expected: false },
    { domain: '172.16.0.1', expected: false },
    { domain: '169.254.169.254', expected: false },
    { domain: 'metadata.google.internal', expected: false },

    // Should fail - invalid
    { domain: 'localhost', expected: false },
    { domain: '', expected: false },
    { domain: 'not-a-domain', expected: false },
    { domain: 'a.b', expected: false }, // TLD too short
  ];

  let passed = 0;
  let failed = 0;

  for (const { domain, expected } of tests) {
    const actual = validateDomain(domain);
    if (actual === expected) {
      passed++;
    } else {
      console.error(`FAIL: validateDomain("${domain}") = ${actual}, expected ${expected}`);
      failed++;
    }
  }

  console.log(`SSRF Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

// Export for Vitest
export const ssrfExports = { validateDomain, normalizeDomain };
