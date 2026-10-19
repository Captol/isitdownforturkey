import { Hono } from 'hono';
import { createHmac } from 'node:crypto';
import { ProbeReportSchema, DomainParamSchema, BrowserProbeSchema } from '@isitdownforturkey/shared';
import { validateDomain, normalizeDomain } from '@isitdownforturkey/shared';
import { buildCheckResponse, getConfidence } from '@isitdownforturkey/shared';
import { runBaselineCheck, toGlobalBaseline, upsertDomain, storeBaselineMeasurement, storeProbeMeasurement, storeBrowserMeasurement, bucketMeasurements } from './services/baseline.js';
import type { CloudflareEnvironment } from './bindings.js';
import { verifyProbeSignature, RateLimiter } from '@isitdownforturkey/probe';
import { generateBadge, verdictToBadge } from './services/badge.js';
import { fetchBlockedFeed, fetchDailyExport, renderRssFeed } from './services/export.js';

const app = new Hono<{ Bindings: CloudflareEnvironment }>();

// Security middleware — applied to all routes
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Cache-Control', 'public, max-age=60');
});

// Rate limiters — one per endpoint type
const ingestLimiter = new RateLimiter(60_000, 30);   // 30 reports/min per probe
const registerLimiter = new RateLimiter(60_000, 5);   // 5 registrations/min per IP
const browserLimiter = new RateLimiter(60_000, 10);   // 10 reports/min per IP (generous for browser)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// GET /api/check?domain=example.com
app.get('/api/check', async (c) => {
  const domain = c.req.query('domain');
  if (!domain) return c.json({ error: 'domain query parameter required' }, 400);

  const parsed = DomainParamSchema.safeParse(domain);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const normalized = normalizeDomain(parsed.data);
  if (!validateDomain(normalized)) {
    return c.json({ error: 'domain rejected by SSRF guard' }, 400);
  }

  const db = c.env.DB;

  // Run global baseline check (Layer 1)
  const baselineResult = await runBaselineCheck(normalized);
  const globalBaseline = toGlobalBaseline(baselineResult);

  // Persist to D1
  try {
    const domainId = await upsertDomain(db, normalized);
    await storeBaselineMeasurement(db, domainId, baselineResult);
  } catch (err) {
    // Non-fatal: baseline result still returned even if D1 write fails
    console.error('D1 write failed:', err);
  }

  // Query recent probe and browser measurements from D1
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  let ispProbes: Record<string, Array<{ domain: string; isp: string; asn: number; tcpConnected: boolean; tlsSucceeded: boolean; httpStatus?: number; blockReason?: string; latencyMs: number; timestamp: string }>> = {};
  let browserProbe: { domain: string; timestamp: string; tcpConnected: boolean; tlsSucceeded: boolean; httpStatus?: number; latencyMs: number; asn?: number; isp?: string } | null = null;
  try {
    const probeRows = await db.prepare(
      `SELECT m.isp, m.asn, m.status, m.block_reason, m.latency_ms, m.payload
       FROM measurements m
       JOIN domains d ON d.id = m.domain_id
       WHERE d.domain = ? AND m.source = 'probe' AND m.created_at >= ?
       ORDER BY m.created_at DESC LIMIT 200`
    ).bind(normalized, since).all();

    for (const row of (probeRows.results ?? [])) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const isp = row.isp as string;
      if (!ispProbes[isp]) ispProbes[isp] = [];
      ispProbes[isp].push({
        domain: normalized,
        isp,
        asn: row.asn ?? 0,
        tcpConnected: payload?.tcpConnected ?? true,
        tlsSucceeded: payload?.tlsSucceeded ?? true,
        httpStatus: payload?.httpStatus,
        blockReason: row.block_reason as string | undefined,
        latencyMs: row.latency_ms ?? 0,
        timestamp: payload?.timestamp ?? new Date().toISOString(),
      });
    }

    const browserRow = await db.prepare(
      `SELECT m.asn, m.isp, m.latency_ms, m.payload
       FROM measurements m
       JOIN domains d ON d.id = m.domain_id
       WHERE d.domain = ? AND m.source = 'browser' AND m.created_at >= ?
       ORDER BY m.created_at DESC LIMIT 1`
    ).bind(normalized, since).first();

    if (browserRow) {
      const payload = typeof browserRow.payload === 'string' ? JSON.parse(browserRow.payload) : browserRow.payload;
      browserProbe = {
        domain: normalized,
        timestamp: payload?.timestamp ?? new Date().toISOString(),
        tcpConnected: payload?.tcpConnected ?? false,
        tlsSucceeded: payload?.tlsSucceeded ?? false,
        httpStatus: payload?.httpStatus,
        latencyMs: browserRow.latency_ms ?? 0,
        asn: browserRow.asn ?? undefined,
        isp: browserRow.isp as string | undefined,
      };
    }
  } catch (err) {
    console.error('D1 probe read failed:', err);
  }

  // Persist baseline and return response with real probe data
  try {
    const domainId = await upsertDomain(db, normalized);
    await storeBaselineMeasurement(db, domainId, baselineResult);
  } catch (err) {
    console.error('D1 write failed:', err);
  }

  const response = buildCheckResponse({
    domain: normalized,
    globalBaseline,
    ispProbes,
    browserProbe,
  });

  return c.json(response);
});

// POST /api/probes/report — signed probe ingest with HMAC verification + rate limiting
app.post('/api/probes/report', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'request body required' }, 400);

  const parsed = ProbeReportSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const { signature, ...report } = parsed.data;
  const token = c.env.PROBE_HMAC_SECRET;

  // Verify HMAC signature
  if (!verifyProbeSignature(token, report, signature)) {
    return c.json({ error: 'invalid signature' }, 401);
  }

  // Rate limit per probe ID
  if (!ingestLimiter.check(report.probeId)) {
    return c.json({ error: 'rate limited' }, 429);
  }

  // Verify ASN matches request context (anti-spoofing)
  const reqAsn = c.req.raw.cf?.asn;
  if (reqAsn && report.asn !== reqAsn) {
    return c.json({ error: 'ASN mismatch — probe IP does not match registered ASN' }, 403);
  }

  // Store in D1
  const db = c.env.DB;
  try {
    const domainId = await upsertDomain(db, report.domain);
    await storeProbeMeasurement(db, domainId, report.probeId, report.asn, report.isp, {
      domain: report.domain,
      dnsResolved: !!(report.systemDns?.length || report.dohCloudflare?.length),
      cfDnsRecords: report.dohCloudflare ?? [],
      googleDnsRecords: report.dohGoogle ?? [],
      httpsReachable: !!(report.tcpConnected && report.tlsSucceeded) && (report.httpStatus === undefined || report.httpStatus >= 200),
      httpStatus: report.httpStatus,
      latencyMs: report.httpLatencyMs ?? report.tcpLatencyMs ?? 0,
      timestamp: report.timestamp,
    });
  } catch (err) {
    console.error('D1 write failed:', err);
  }

  // Update probe node reputation
  try {
    await db.prepare(
      `UPDATE probe_nodes SET reports_total = reports_total + 1, reports_valid = reports_valid + 1, last_seen = ? WHERE probe_id = ?`
    ).bind(report.timestamp, report.probeId).run();
  } catch { /* probe may not be registered yet — non-fatal */ }

  return c.json({ accepted: true, probeId: report.probeId });
});

// POST /api/probes/register — issue new probe token with HMAC-signed credential
app.post('/api/probes/register', async (c) => {
  const { asn } = await c.req.json().catch(() => ({})) as { asn?: number };
  if (!asn) return c.json({ error: 'asn required' }, 400);

  // Rate limit registration attempts
  const ipKey = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!registerLimiter.check(ipKey)) {
    return c.json({ error: 'rate limited' }, 429);
  }

  const probeId = crypto.randomUUID();
  const token = crypto.getRandomValues(new Uint8Array(32));
  const tokenHex = Buffer.from(token).toString('hex');

  // Store probe node in D1
  const db = c.env.DB;
  try {
    const hmacKeyHash = createHmac('sha256', c.env.PROBE_HMAC_SECRET)
      .update(tokenHex)
      .digest('hex');
    await db.prepare(
      `INSERT INTO probe_nodes (probe_id, hmac_key_hash, asn, isp, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(probeId, hmacKeyHash, asn, null).run();
  } catch (err) {
    console.error('Probe registration D1 error:', err);
    // Non-fatal: token still works even if D1 write fails (idempotent by design)
  }

  return c.json({
    probeId,
    token: tokenHex,
    message: 'Store this token securely. It signs all future probe reports. Never share it.',
  });
});

// POST /api/browser/report — anonymized browser probe (no auth, rate-limited)
app.post('/api/browser/report', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'request body required' }, 400);

  const parsed = BrowserProbeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  // Rate limit per IP (generous for browser probes)
  const ipKey = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!browserLimiter.check(ipKey)) {
    return c.json({ error: 'rate limited' }, 429);
  }

  // Anti-spoof: if request has Cloudflare ASN, verify report ASN matches
  const reqAsn = c.req.raw.cf?.asn;
  if (reqAsn && parsed.data.asn && parsed.data.asn !== reqAsn) {
    return c.json({ error: 'ASN mismatch' }, 403);
  }

  // Store in D1
  const db = c.env.DB;
  try {
    const domainId = await upsertDomain(db, parsed.data.domain);
    await storeBrowserMeasurement(
      db, domainId,
      parsed.data.asn ?? 0,
      parsed.data.isp ?? 'other',
      parsed.data.tcpConnected,
      parsed.data.tlsSucceeded,
      parsed.data.httpStatus,
      parsed.data.latencyMs,
      parsed.data.timestamp,
    );
  } catch (err) {
    console.error('Browser measurement D1 error:', err);
  }

  return c.json({ accepted: true });
});

// GET /api/history/:domain?hours=24 — time-series data for charts
app.get('/api/history/:domain', async (c) => {
  const domain = c.req.param('domain');
  const hoursRaw = c.req.query('hours');
  const hours = hoursRaw ? parseInt(hoursRaw, 10) : 24;
  if (!validateDomain(domain)) return c.json({ error: 'invalid domain' }, 400);

  const db = c.env.DB as D1Database;
  try {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const rows = await db.prepare(
      `SELECT m.source, m.isp, m.status, m.block_reason, m.latency_ms, m.created_at, d.domain
       FROM measurements m
       JOIN domains d ON d.id = m.domain_id
       WHERE d.domain = ? AND m.created_at >= ?
       ORDER BY m.created_at ASC`
    ).bind(domain, since).all();

    const results = (rows.results ?? []) as Array<{
      source: string; isp: string | null; status: string; block_reason: string | null;
      latency_ms: number | null; created_at: string; domain: string;
    }>;

    const chartData = bucketMeasurements(results);

    return c.json({ domain, hours, chartData });
  } catch (err) {
    console.error('History query error:', err);
    return c.json({ error: 'query failed' }, 500);
  }
});

// GET /api/watchlist/status — check all watchlisted domains at once
app.get('/api/watchlist/status', async (c) => {
  const db = c.env.DB as D1Database;
  try {
    const domains = await db.prepare(
      `SELECT domain, category FROM domains WHERE watchlist = 1 ORDER BY domain`
    ).all();

    const results = (domains.results ?? []) as Array<{ domain: string; category: string }>;

    // For each domain, get latest measurement
    const statusList = await Promise.all(results.map(async ({ domain, category }) => {
      const latest = await db.prepare(
        `SELECT source, isp, status, block_reason, latency_ms, created_at
         FROM measurements WHERE domain_id = (SELECT id FROM domains WHERE domain = ?)
         ORDER BY created_at DESC LIMIT 1`
      ).bind(domain).first();

      return {
        domain,
        category,
        latestStatus: (latest as { status: string } | null)?.status ?? 'unknown',
        blockReason: (latest as { block_reason: string | null } | null)?.block_reason,
        latencyMs: (latest as { latency_ms: number | null } | null)?.latency_ms,
        lastChecked: (latest as { created_at: string } | null)?.created_at,
      };
    }));

    return c.json({ services: statusList });
  } catch (err) {
    console.error('Watchlist status error:', err);
    return c.json({ error: 'query failed' }, 500);
  }
});

// POST /api/cron/watchlist — hourly aggregation cron job
app.post('/api/cron/watchlist', async (c) => {
  const db = c.env.DB as D1Database;

  // Compute last hour's rollups
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
  const hourBucket = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH

  try {
    // Aggregate measurements into hourly_rollups
    await db.prepare(`
      INSERT OR REPLACE INTO hourly_rollups (domain_id, isp, hour_bucket, up_count, blocked_count, down_count, avg_latency)
      SELECT
        domain_id,
        COALESCE(isp, 'other'),
        ?,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status IN ('down', 'unknown') THEN 1 ELSE 0 END),
        AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END)
      FROM measurements
      WHERE created_at >= ?
      GROUP BY domain_id, COALESCE(isp, 'other')
    `).bind(hourBucket, hourAgo).run();

    // Update watchlisted domains with latest verdict
    const watchlisted = await db.prepare(
      `SELECT d.id, d.domain FROM domains d WHERE d.watchlist = 1`
    ).all();

    for (const row of (watchlisted.results ?? [])) {
      const latest = await db.prepare(
        `SELECT status, block_reason, created_at FROM measurements WHERE domain_id = ? ORDER BY created_at DESC LIMIT 1`
      ).bind(row.id).first();
      // Could update a `last_verdict` column here if we add one
    }

    return c.json({ ok: true, rowsAggregated: (await db.prepare(`SELECT COUNT(*) as cnt FROM hourly_rollups WHERE hour_bucket = ?`).bind(hourBucket).first())?.cnt ?? 0 });
  } catch (err) {
    console.error('Cron aggregation error:', err);
    return c.json({ error: 'cron failed' }, 500);
  }
});

// GET /api/badge/:domain — embeddable status badge (returns SVG)
app.get('/api/badge/:domain', async (c) => {
  const domain = c.req.param('domain');
  if (!validateDomain(domain)) return c.json({ error: 'invalid domain' }, 400);

  // Run a fresh baseline check to determine current status
  const baselineResult = await runBaselineCheck(domain);
  const verdict: string = baselineResult.httpsReachable ? 'UP' : 'DOWN_GLOBALLY';
  const svg = generateBadge({ domain, verdict: verdictToBadge(verdict) });
  return c.newResponse(svg, 200, { 'Content-Type': 'image/svg+xml' });
});

// GET /api/feed.xml — RSS feed of recent blocks/outages from Türkiye probes
app.get('/api/feed.xml', async (c) => {
  const db = c.env.DB as D1Database;
  try {
    const entries = await fetchBlockedFeed(db);
    const xml = renderRssFeed(entries);
    return c.newResponse(xml, 200, { 'Content-Type': 'application/rss+xml' });
  } catch (err) {
    console.error('Feed query error:', err);
    return c.json({ error: 'query failed' }, 500);
  }
});

// GET /api/export/daily.json — open data snapshot of recent measurements
app.get('/api/export/daily.json', async (c) => {
  const db = c.env.DB as D1Database;
  try {
    const rows = await fetchDailyExport(db);
    return c.json({ generatedAt: new Date().toISOString(), count: rows.length, data: rows });
  } catch (err) {
    console.error('Export query error:', err);
    return c.json({ error: 'query failed' }, 500);
  }
});

// GET /api/watchlist — curated list of tracked services
app.get('/api/watchlist', (c) => {
  const services = [
    { domain: 'github.com', category: 'dev' },
    { domain: 'openai.com', category: 'dev' },
    { domain: 'anthropic.com', category: 'dev' },
    { domain: 'discord.com', category: 'social' },
    { domain: 'steamcommunity.com', category: 'gaming' },
    { domain: 'npmjs.com', category: 'dev' },
    { domain: 'hub.docker.com', category: 'dev' },
    { domain: 'huggingface.co', category: 'dev' },
  ];
  return c.json({ services });
});

export default app;
