/**
 * SVG badge generator for isitdownforturkey.
 *
 * Produces a ShIELDS.io-compatible badge: colored rectangle + label + value.
 * Used by GET /api/badge/:domain.svg.
 */

export type BadgeVerdict = 'up' | 'blocked' | 'down_globally' | 'degraded' | 'unknown';

interface BadgeOptions {
  domain: string;
  verdict: BadgeVerdict;
  label?: string;
}

const COLORS: Record<BadgeVerdict, { bg: string; text: string }> = {
  'up': { bg: '#22c55e', text: '#ffffff' },
  'blocked': { bg: '#ef4444', text: '#ffffff' },
  'down_globally': { bg: '#6b7280', text: '#ffffff' },
  'degraded': { bg: '#f59e0b', text: '#ffffff' },
  'unknown': { bg: '#9ca3af', text: '#ffffff' },
};

const LABEL_TEXT: Record<BadgeVerdict, string> = {
  'up': 'up',
  'blocked': 'blocked',
  'down_globally': 'down',
  'degraded': 'degraded',
  'unknown': 'unknown',
};

/**
 * Generate an SVG badge string for a given domain and verdict.
 */
export function generateBadge({ domain, verdict, label = 'isitdown' }: BadgeOptions): string {
  const colors = COLORS[verdict];
  const statusText = LABEL_TEXT[verdict];
  const labelText = label;

  // Measure text widths (approximate: monospace ~7px per char at 11px font)
  const charWidth = 7;
  const statusWidth = statusText.length * charWidth;
  const labelWidth = labelText.length * charWidth;
  const domainWidth = Math.min(domain.length, 20) * charWidth; // cap domain display
  const innerWidth = labelWidth + 6 + statusWidth + 6 + domainWidth;
  const totalWidth = Math.max(innerWidth + 12, 110);
  const height = 20;

  // Truncate domain if too long
  const displayDomain = domain.length > 20 ? domain.slice(0, 17) + '…' : domain;
  const displayDomainWidth = displayDomain.length * charWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">
  <defs>
    <linearGradient id="g" x2="0" y2="1">
      <stop offset="0" stop-color="${colors.bg}" stop-opacity=".8"/>
      <stop offset="1" stop-color="${colors.bg}" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <rect width="${totalWidth}" height="${height}" fill="#555" rx="3"/>
  <rect width="${totalWidth - 60}" height="${height}" fill="url(#g)" rx="3"/>
  <text x="6" y="14" fill="${colors.text}" font-family="sans-serif" font-size="11" font-weight="bold">${escapeXml(labelText)}</text>
  <text x="${6 + labelWidth + 6}" y="14" fill="${colors.text}" font-family="sans-serif" font-size="11">${escapeXml(statusText)}</text>
  <text x="${totalWidth - displayDomainWidth - 8}" y="14" fill="#fff" font-family="sans-serif" font-size="11" text-anchor="end">${escapeXml(displayDomain)}</text>
</svg>`;
}

/**
 * Escape XML special characters.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Derive a badge verdict from a CheckResponse-level verdict string.
 */
export function verdictToBadge(verdict: string): BadgeVerdict {
  switch (verdict) {
    case 'UP': return 'up';
    case 'BLOCKED': return 'blocked';
    case 'DOWN_GLOBALLY': return 'down_globally';
    case 'DEGRADED': return 'degraded';
    default: return 'unknown';
  }
}
