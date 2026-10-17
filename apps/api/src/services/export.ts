/**
 * Data export services — RSS feed and daily open-data snapshot.
 * These endpoints serve public data aggregated from D1 measurements.
 * No user-specific data; no IPs logged.
 */

import type { D1Database } from '@cloudflare/workers-types';

// ─── RSS Feed ────────────────────────────────────────────────────────────────

/**
 * Fetch recent blocked measurements from D1 and render an RSS feed.
 * Limits to 50 entries to stay within D1 free-tier query sizes.
 */
export async function fetchBlockedFeed(db: D1Database): Promise<Array<{
  domain: string;
  status: string;
  block_reason: string | null;
  created_at: string;
  isp?: string | null;
}>> {
  const rows = await db.prepare(`
    SELECT d.domain, m.status, m.block_reason, m.created_at, m.isp
    FROM measurements m
    JOIN domains d ON d.id = m.domain_id
    WHERE m.status IN ('blocked', 'down')
      AND m.source != 'global'
      AND m.created_at >= datetime('now', '-24 hours')
    ORDER BY m.created_at DESC
    LIMIT 50
  `).all();

  return (rows.results ?? []) as Array<{
    domain: string;
    status: string;
    block_reason: string | null;
    created_at: string;
    isp?: string | null;
  }>;
}

/**
 * Render blocked measurements as an RSS 2.0 XML string.
 */
export function renderRssFeed(entries: Array<{
  domain: string;
  status: string;
  block_reason: string | null;
  created_at: string;
  isp?: string | null;
}>): string {
  const itemEls = entries.map((e) => {
    const title = e.block_reason
      ? `${e.domain} — ${e.block_reason}`
      : `${e.domain} — ${e.status}`;
    const desc = e.isp
      ? `Status: ${e.status}, ISP: ${e.isp}, Reason: ${e.block_reason ?? 'none'}`
      : `Status: ${e.status}, Reason: ${e.block_reason ?? 'none'}`;
    return `  <item>\n    <title>${xmlEscape(title)}</title>\n    <link>https://isitdownforturkey.pages.dev/d/${encodeURIComponent(e.domain)}</link>\n    <description>${xmlEscape(desc)}</description>\n    <pubDate>${new Date(e.created_at).toUTCString()}</pubDate>\n    <guid>https://isitdownforturkey.pages.dev/d/${encodeURIComponent(e.domain)}#${e.created_at}</guid>\n  </item>`;
  }).join('\n');

  const now = new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Is It Down For Türkiye? — Block Feed</title>
    <link>https://isitdownforturkey.pages.dev</link>
    <description>Recent blocks and outages detected from Turkish ISPs.</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="https://isitdownforturkey.pages.dev/api/feed.xml" rel="self" type="application/rss+xml"/>
    ${itemEls}
  </channel>
</rss>`;
}

// ─── Daily Export ──────────────────────────────────────────────────────────────

/**
 * Fetch recent measurements (all sources) for open data export.
 * Returns up to 500 rows from the last 24 hours.
 */
export async function fetchDailyExport(db: D1Database): Promise<Array<{
  domain: string;
  source: string;
  asn: number | null;
  isp: string | null;
  status: string;
  block_reason: string | null;
  latency_ms: number | null;
  created_at: string;
}>> {
  const rows = await db.prepare(`
    SELECT d.domain, m.source, m.asn, m.isp, m.status, m.block_reason, m.latency_ms, m.created_at
    FROM measurements m
    JOIN domains d ON d.id = m.domain_id
    WHERE m.created_at >= datetime('now', '-24 hours')
    ORDER BY m.created_at DESC
    LIMIT 500
  `).all();

  return (rows.results ?? []) as Array<{
    domain: string;
    source: string;
    asn: number | null;
    isp: string | null;
    status: string;
    block_reason: string | null;
    latency_ms: number | null;
    created_at: string;
  }>;
}

/**
 * XML escape helper — prevents injection in feed content.
 */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
