/**
 * Volunteer Probe Agent — Node.js (zero external dependencies)
 *
 * Runs from inside Turkish ISPs and reports reachability measurements
 * to the isitdownforturkey API. Reports are HMAC-signed for authenticity.
 *
 * Usage:
 *   node index.js                     # continuous mode (every 60s)
 *   node index.js --once              # single run, then exit
 *   node index.js --domains example.com discord.com
 *   node index.js --token <your-token> --api-url https://api.example.com
 *
 * Environment variables:
 *   PROBE_TOKEN    — HMAC signing token (from /api/probes/register)
 *   PROBE_API_URL  — API base URL (default: http://localhost:8787)
 *   PROBE_INTERVAL — polling interval in seconds (default: 60)
 */

import { createHmac, randomUUID } from 'node:crypto';
import { resolve } from 'node:dns/promises';
import { connect } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_API_URL = process.env.PROBE_API_URL ?? 'http://localhost:8787';
const DEFAULT_INTERVAL = parseInt(process.env.PROBE_INTERVAL ?? '60', 10);
const TOKEN_FILE = '.probe_token';
const STATE_FILE = '.probe_state.json';

const API_URL = process.argv.includes('--once')
  ? DEFAULT_API_URL
  : DEFAULT_API_URL;

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    once: false,
    domains: [],
    token: process.env.PROBE_TOKEN ?? '',
    apiUrl: DEFAULT_API_URL,
    interval: DEFAULT_INTERVAL,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--once': config.once = true; break;
      case '--token': config.token = args[++i] ?? ''; break;
      case '--api-url': config.apiUrl = args[++i] ?? DEFAULT_API_URL; break;
      case '--interval': config.interval = parseInt(args[++i] ?? '60', 10); break;
      case '--': config.domains = args.slice(i + 1); break;
      default:
        if (!args[i].startsWith('-')) {
          config.domains.push(args[i]);
        }
    }
  }

  if (config.once) config.interval = 0;
  return config;
}

// ─── Token Management ────────────────────────────────────────────────────────

function loadToken() {
  const dir = dirname(fileURLToPath(import.meta.url));
  const path = join(dir, TOKEN_FILE);
  if (existsSync(path)) return readFileSync(path, 'utf8').trim();
  return process.env.PROBE_TOKEN ?? '';
}

function saveToken(token) {
  const dir = dirname(fileURLToPath(import.meta.url));
  writeFileSync(join(dir, TOKEN_FILE), token, 'utf8');
}

// ─── ASN Detection ───────────────────────────────────────────────────────────

/**
 * Detect our public-facing ASN via a lightweight HTTP call to an ASN lookup service.
 * Falls back to 0 if unavailable.
 */
async function detectASN(): Promise<number> {
  try {
    const resp = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5000),
    });
    const ip = (await resp.json()) as { ip: string };
    if (!ip.ip) return 0;

    // Use IP2Location free API or similar — fall back to 0
    const asnResp = await fetch(`https://api.ip2location.com/?ip=${ip.ip}&key=`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (asnResp?.ok) {
      const data = await asnResp.json() as { asnx?: string };
      return parseInt(data.asnx ?? '0', 10) || 0;
    }
  } catch { /* ignore */ }

  // Alternative: use ip-api.com (free, no key needed for basic lookup)
  try {
    const resp = await fetch(`http://ip-api.com/json/?fields=as`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json() as { as?: string };
    if (data.as) return parseInt(data.as.replace('AS', ''), 10) || 0;
  } catch { /* ignore */ }

  return 0;
}

// ─── DNS Resolution ──────────────────────────────────────────────────────────

/**
 * Resolve domain using system DNS resolver.
 */
async function resolveSystemDns(domain: string): Promise<string[]> {
  try {
    const results = await resolve(domain, 'A');
    return results.filter((r): r is string => typeof r === 'string');
  } catch {
    return [];
  }
}

/**
 * Resolve domain via Cloudflare DoH.
 */
async function resolveDoH(domain: string, url: string): Promise<string[]> {
  try {
    const resp = await fetch(`${url}?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = await resp.json() as { Answer?: { data: string }[] };
    return data.Answer?.map(a => a.data) ?? [];
  } catch {
    return [];
  }
}

// ─── TCP/TLS/HTTP Probing ────────────────────────────────────────────────────

/**
 * Test TCP connectivity to a domain on port 443.
 */
async function testTcpConnect(domain: string): Promise<{ connected: boolean; latencyMs: number }> {
  const start = Date.now();
  return new Promise(resolve => {
    const sock = connect(443, domain, () => {
      sock.destroy();
      resolve({ connected: true, latencyMs: Date.now() - start });
    });
    sock.on('error', () => {
      resolve({ connected: false, latencyMs: Date.now() - start });
    });
    setTimeout(() => {
      sock.destroy();
      resolve({ connected: false, latencyMs: Date.now() - start });
    }, 5000);
  });
}

/**
 * Test TLS handshake to a domain.
 */
async function testTls(domain: string): Promise<{ succeeded: boolean; error?: string; latencyMs: number }> {
  const start = Date.now();
  return new Promise(resolve => {
    const opts = {
      host: domain,
      port: 443,
      rejectUnauthorized: false,
      servername: domain,
      timeout: 5000,
    };
    const req = httpsRequest(opts, res => {
      res.destroy();
      resolve({ succeeded: true, latencyMs: Date.now() - start });
    });
    req.on('error', err => {
      resolve({ succeeded: false, error: err.code ?? err.message, latencyMs: Date.now() - start });
    });
    req.end();
  });
}

/**
 * Make an HTTP GET request and collect basic response info.
 */
async function testHttp(domain: string): Promise<{
  status?: number;
  title?: string;
  bodySnippet?: string;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  return new Promise(resolve => {
    const opts = {
      hostname: domain,
      port: 443,
      path: '/',
      method: 'GET',
      rejectUnauthorized: false,
      headers: { 'User-Agent': 'isitdownforturkey-probe/1.0' },
      timeout: 8000,
    };
    const req = httpsRequest(opts, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        // Extract title
        const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch?.[1]?.trim();
        resolve({
          status: res.statusCode,
          title,
          bodySnippet: body.slice(0, 500),
          latencyMs: Date.now() - start,
        });
      });
    });
    req.on('error', err => {
      resolve({ latencyMs: Date.now() - start, error: err.message });
    });
    req.end();
  });
}

// ─── Block Detection ─────────────────────────────────────────────────────────

/**
 * Detect if an HTTP response is a BTK/ISP block page.
 */
function detectBlockPage(title?: string, body?: string): 'dns_poisoning' | 'sni_reset' | 'http_block_page' | 'ip_block' | null {
  if (!title && !body) return null;

  const text = ((title ?? '') + ' ' + (body ?? '')).toLowerCase();

  // BTK block page indicators
  const blockPatterns = [
    /5651\s*sayılı\s*kanaat/i,
    /5651\s*sayılı\s*kanun/i,
    /adli\s*müdahale/i,
    /erişim\s*engellenmiştir/i,
    /site\s*engellenmiştir/i,
    /internet\s*engelleme/i,
    /mahkeme\s*kararı/i,
  ];

  for (const pattern of blockPatterns) {
    if (pattern.test(text)) return 'http_block_page';
  }

  return null;
}

// ─── Report Signing ──────────────────────────────────────────────────────────

/**
 * Sign a probe report with HMAC-SHA256.
 */
function signReport(token: string, report: Record<string, unknown>): string {
  const payload = JSON.stringify(report);
  return createHmac('sha256', token).update(payload).digest('hex');
}

// ─── Main Probe Logic ────────────────────────────────────────────────────────

interface ProbeResult {
  domain: string;
  probeId: string;
  timestamp: string;
  asn: number;
  isp: string;
  systemDns: string[] | null;
  dohCloudflare: string[] | null;
  dohGoogle: string[] | null;
  tcpConnected: boolean;
  tlsSucceeded: boolean;
  httpStatus?: number;
  httpResponseHeaders: Record<string, string>;
  htmlTitle?: string;
  blockReason?: string;
  tcpLatencyMs?: number;
  tlsLatencyMs?: number;
  httpLatencyMs?: number;
}

/**
 * Run a full probe for a single domain.
 */
async function probeDomain(
  domain: string,
  token: string,
  probeId: string,
  asn: number,
): Promise<ProbeResult | null> {
  // Resolve DNS via multiple methods
  const [systemDns, dohCloudflare, dohGoogle] = await Promise.all([
    resolveSystemDns(domain),
    resolveDoH(domain, 'https://1.1.1.1/dns-query'),
    resolveDoH(domain, 'https://dns.google/resolve'),
  ]);

  // Test TCP connectivity
  const tcpResult = await testTcpConnect(domain);

  // If TCP fails, no point continuing
  if (!tcpResult.connected) {
    return {
      domain,
      probeId,
      timestamp: new Date().toISOString(),
      asn,
      isp: 'other', // Will be overridden by API if ASN matches known ISP
      systemDns: systemDns.length ? systemDns : null,
      dohCloudflare: dohCloudflare.length ? dohCloudflare : null,
      dohGoogle: dohGoogle.length ? dohGoogle : null,
      tcpConnected: false,
      tlsSucceeded: false,
      tcpLatencyMs: tcpResult.latencyMs,
    };
  }

  // Test TLS handshake
  const tlsResult = await testTls(domain);

  // If TLS fails, check if it's an SNI reset
  if (!tlsResult.succeeded) {
    return {
      domain,
      probeId,
      timestamp: new Date().toISOString(),
      asn,
      isp: 'other',
      systemDns: systemDns.length ? systemDns : null,
      dohCloudflare: dohCloudflare.length ? dohCloudflare : null,
      dohGoogle: dohGoogle.length ? dohGoogle : null,
      tcpConnected: true,
      tlsSucceeded: false,
      tcpLatencyMs: tcpResult.latencyMs,
      tlsLatencyMs: tlsResult.latencyMs,
      blockReason: 'sni_reset',
    };
  }

  // Make HTTP request
  const httpResult = await testHttp(domain);

  // Detect block page
  const blockReason = detectBlockPage(httpResult.title, httpResult.bodySnippet);

  return {
    domain,
    probeId,
    timestamp: new Date().toISOString(),
    asn,
    isp: 'other',
    systemDns: systemDns.length ? systemDns : null,
    dohCloudflare: dohCloudflare.length ? dohCloudflare : null,
    dohGoogle: dohGoogle.length ? dohGoogle : null,
    tcpConnected: true,
    tlsSucceeded: true,
    httpStatus: httpResult.status,
    htmlTitle: httpResult.title,
    blockReason: blockReason ?? undefined,
    tcpLatencyMs: tcpResult.latencyMs,
    tlsLatencyMs: tlsResult.latencyMs,
    httpLatencyMs: httpResult.latencyMs,
  };
}

// ─── Report Submission ───────────────────────────────────────────────────────

async function submitReport(
  apiUrl: string,
  token: string,
  report: ProbeResult,
): Promise<{ ok: boolean; error?: string }> {
  // Sign the report
  const signedReport = {
    ...report,
    signature: signReport(token, report),
  };

  try {
    const resp = await fetch(`${apiUrl}/api/probes/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedReport),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      return { ok: false, error: `HTTP ${resp.status}: ${err}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── State Persistence ───────────────────────────────────────────────────────

interface ProbeState {
  probeId: string;
  lastRun: string;
  lastDomain: string;
  consecutiveFailures: number;
}

function loadState(): ProbeState {
  const dir = dirname(fileURLToPath(import.meta.url));
  const path = join(dir, STATE_FILE);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as ProbeState;
    } catch { /* ignore */ }
  }
  return { probeId: randomUUID(), lastRun: '', lastDomain: '', consecutiveFailures: 0 };
}

function saveState(state: ProbeState) {
  const dir = dirname(fileURLToPath(import.meta.url));
  writeFileSync(join(dir, STATE_FILE), JSON.stringify(state, null, 2));
}

// ─── Main ────────────────────────────────────────────────────────────────────

const KNOWN_ISPS = ['turk-telekom', 'turkcell-superonline', 'turknet', 'vodafone-tr', 'tursat-kablonet', 'other'];

async function main() {
  const config = parseArgs();
  const token = config.token || loadToken();

  if (!token) {
    console.error('ERROR: No probe token found. Register at /api/probes/register or set PROBE_TOKEN env var.');
    console.error('Usage: node index.js --token <your-token> [--api-url <url>] [--once]');
    process.exit(1);
  }

  // Detect ASN
  console.log('Detecting ASN...');
  const asn = await detectASN();
  console.log(`ASN detected: ${asn || '(unknown)'}`);

  // Determine domains to probe
  const domains = config.domains.length > 0 ? config.domains : [
    'discord.com',
    'github.com',
    'steamcommunity.com',
    'openai.com',
    'anthropic.com',
    'npmjs.com',
    'hub.docker.com',
    'huggingface.co',
    'twitter.com',
    'facebook.com',
    'instagram.com',
    'youtube.com',
    'whatsapp.com',
    'telegram.org',
    'pinterest.com',
    'reddit.com',
    'tiktok.com',
    'linkedin.com',
    'spotify.com',
    'netflix.com',
  ];

  const state = loadState();
  let probeId = state.probeId;
  let consecutiveFailures = 0;

  async function runOneCycle() {
    console.log(`[${new Date().toISOString()}] Running probe cycle for ${domains.length} domains...`);

    for (const domain of domains) {
      try {
        const report = await probeDomain(domain, token, probeId, asn);
        if (!report) continue;

        // Override ISP based on ASN if possible
        // (The API will do the final classification, but we can hint)
        const result = await submitReport(config.apiUrl, token, report);

        if (result.ok) {
          consecutiveFailures = 0;
          state.lastDomain = domain;
          state.lastRun = new Date().toISOString();
          saveState(state);
          console.log(`  ✓ ${domain}`);
        } else {
          consecutiveFailures++;
          console.error(`  ✗ ${domain}: ${result.error}`);
        }
      } catch (err) {
        consecutiveFailures++;
        console.error(`  ✗ ${domain}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Exponential backoff on consecutive failures
    if (consecutiveFailures > 5) {
      console.warn(`High failure rate (${consecutiveFailures}). Waiting longer before next cycle.`);
      await new Promise(r => setTimeout(r, 30000));
    }
  }

  // Run once or loop
  await runOneCycle();

  if (config.once) {
    console.log('Single run complete.');
    process.exit(0);
  }

  // Continuous mode
  console.log(`Continuous mode: probing every ${config.interval}s`);
  while (true) {
    await runOneCycle();
    await new Promise(r => setTimeout(r, config.interval * 1000));
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export {
  probeDomain,
  submitReport,
  detectASN,
  resolveSystemDns,
  resolveDoH,
  testTcpConnect,
  testTls,
  testHttp,
  detectBlockPage,
  signReport,
  loadToken,
  saveToken,
  type ProbeResult,
  type ProbeState,
};
