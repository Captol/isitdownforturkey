#!/usr/bin/env node
/**
 * isitdownforturkey CLI
 * Check whether a domain is reachable from Türkiye via the API.
 * Zero dependencies — uses only the Node.js built-in `fetch`.
 */
'use strict';

const API_BASE = process.env.API_BASE ?? 'https://isitdownforturkey.pages.dev';
const USAGE = `
  isitdownforturkey <domain> [options]

  Options:
    --json        Output raw JSON instead of human-readable text
    --api-url     Override API base URL (default: https://isitdownforturkey.pages.dev)
    -h, --help    Show this help

  Example:
    isitdownforturkey github.com
    isitdownforturkey discord.com --json
`.trim();

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(USAGE);
    process.exit(0);
  }

  let domain = null;
  let json = false;
  let apiUrl = API_BASE;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      if (a === '--json') json = true;
      else if (a === '--api-url' && args[i + 1]) apiUrl = args[++i];
      else if (a === '--help' || a === '-h') {
        console.log(USAGE);
        process.exit(0);
      }
    } else if (!domain) {
      domain = a;
    }
  }

  if (!domain) {
    console.error('Error: domain argument is required');
    console.error('Run with --help for usage.');
    process.exit(1);
  }

  return { domain, json, apiUrl };
}

function fmtVerdict(verdict, lang) {
  const map = {
    tr: {
      UP: '✅ Çalışıyor',
      BLOCKED: '🚫 Engellenmiş',
      DOWN_GLOBALLY: '⚠️ Globalde çökük',
      DEGRADED: '🟡 Bozulmuş',
      UNKNOWN: '❓ Bilinmiyor',
    },
    en: {
      UP: '✅ UP',
      BLOCKED: '🚫 BLOCKED',
      DOWN_GLOBALLY: '⚠️ DOWN GLOBALLY',
      DEGRADED: '🟡 DEGRADED',
      UNKNOWN: '❓ UNKNOWN',
    },
  };
  return map[lang]?.[verdict] ?? verdict;
}

async function main() {
  const { domain, json, apiUrl } = parseArgs(process.argv);

  const url = `${apiUrl.replace(/\/$/, '')}/api/check?domain=${encodeURIComponent(domain)}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    console.error(`Error: could not reach API at ${url}`);
    console.error(err.message);
    process.exit(1);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(`API error ${res.status}: ${errBody || res.statusText}`);
    process.exit(1);
  }

  const data = await res.json();

  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const lang = 'en'; // CLI defaults to English for simplicity
  console.log(`\n${domain}`);
  console.log(fmtVerdict(data.verdict, lang));
  if (data.blockReason) {
    console.log(`  Reason: ${data.blockReason}`);
  }
  console.log(`  Confidence: ${data.confidence}`);
  if (data.globalBaseline) {
    const gb = data.globalBaseline;
    console.log(`  DNS: ${gb.dnsResolved ? 'resolved' : 'not resolved'}`);
    console.log(`  HTTPS: ${gb.httpsReachable ? 'reachable' : 'not reachable'} (${gb.latencyMs}ms)`);
  }
  const ISPs = Object.keys(data.ispBreakdown ?? {});
  if (ISPs.length > 0) {
    console.log(`  ISP data from: ${ISPs.join(', ')}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
