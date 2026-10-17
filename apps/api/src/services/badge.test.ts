import { describe, it, expect } from 'vitest';
import { generateBadge, verdictToBadge } from './badge.js';

describe('generateBadge', () => {
  it('produces valid SVG markup', () => {
    const svg = generateBadge({ domain: 'example.com', verdict: 'up' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('example.com');
    expect(svg).toContain('up');
  });

  it('uses correct colors per verdict', () => {
    expect(generateBadge({ domain: 'x.com', verdict: 'up' })).toContain('#22c55e');
    expect(generateBadge({ domain: 'x.com', verdict: 'blocked' })).toContain('#ef4444');
    expect(generateBadge({ domain: 'x.com', verdict: 'down_globally' })).toContain('#6b7280');
    expect(generateBadge({ domain: 'x.com', verdict: 'degraded' })).toContain('#f59e0b');
    expect(generateBadge({ domain: 'x.com', verdict: 'unknown' })).toContain('#9ca3af');
  });

  it('truncates long domains', () => {
    const longDomain = 'a'.repeat(50) + '.com';
    const svg = generateBadge({ domain: longDomain, verdict: 'up' });
    expect(svg).not.toContain(longDomain);
    expect(svg).toContain('a'.repeat(17) + '…');
  });

  it('escapes XML special chars in domain', () => {
    const svg = generateBadge({ domain: 'foo&bar.com', verdict: 'up' });
    expect(svg).toContain('&amp;');
    expect(svg).not.toContain('foo&bar.com');
  });

  it('allows custom label', () => {
    const svg = generateBadge({ domain: 'x.com', verdict: 'up', label: 'status' });
    expect(svg).toContain('status');
    expect(svg).not.toContain('isitdown');
  });
});

describe('verdictToBadge', () => {
  it('maps CHECK_RESPONSE verdicts to badge verdicts', () => {
    expect(verdictToBadge('UP')).toBe('up');
    expect(verdictToBadge('BLOCKED')).toBe('blocked');
    expect(verdictToBadge('DOWN_GLOBALLY')).toBe('down_globally');
    expect(verdictToBadge('DEGRADED')).toBe('degraded');
    expect(verdictToBadge('UNKNOWN')).toBe('unknown');
    expect(verdictToBadge('INVALID')).toBe('unknown');
  });
});
