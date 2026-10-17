/**
 * Browser reachability probe — runs in the visitor's browser.
 *
 * Tests TCP/TLS/HTTP reachability from the user's own connection,
 * detects their ASN via ip-api.com, then reports anonymized results
 * to the isitdownforturkey API.
 *
 * Called from: apps/web/src/components/BrowserCheck.astro (client-side)
 * Reports to:  apps/api/src/index.ts POST /api/browser/report
 * Reads:       ip-api.com for ASN detection
 * Writes:      POST to API /api/browser/report (anonymous, rate-limited)
 */

export interface BrowserProbeResult {
  domain: string;
  tcpConnected: boolean;
  tlsSucceeded: boolean;
  httpStatus?: number;
  latencyMs: number;
  asn?: number;
  isp?: string;
  timestamp: string;
}

/**
 * Detect the user's public IP and ASN via ip-api.com (free, no key).
 * Returns null on failure.
 */
async function detectASN(): Promise<{ ip: string; asn?: number; isp?: string } | null> {
  try {
    const resp = await fetch('http://ip-api.com/json/?fields=ip,as,org', {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { ip: string; as?: string; org?: string };
    if (!data.ip) return null;
    const asnMatch = data.as?.match(/AS(\d+)/);
    return {
      ip: data.ip,
      asn: asnMatch ? parseInt(asnMatch[1], 10) : undefined,
      isp: data.org ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Map ISP name hints to Turkish ISP enum values.
 */
function mapISP(ispName?: string): string | undefined {
  if (!ispName) return undefined;
  const name = ispName.toLowerCase();
  if (name.includes('turk telekom') || name.includes('tt') || name.includes('tcom')) return 'turk-telekom';
  if (name.includes('turkcell') || name.includes('superonline')) return 'turkcell-superonline';
  if (name.includes('turknet')) return 'turknet';
  if (name.includes('vodafone')) return 'vodafone-tr';
  if (name.includes('tursat') || name.includes('kablonet')) return 'tursat-kablonet';
  return 'other';
}

/**
 * Probe a domain from the browser using fetch.
 * No-cors mode is used since we can't control the target's CORS policy.
 * Returns boolean reachability and latency.
 */
async function probeDomain(domain: string): Promise<{
  tcpConnected: boolean;
  tlsSucceeded: boolean;
  httpStatus?: number;
  latencyMs: number;
}> {
  const url = `https://${domain}/`;
  const start = performance.now();

  try {
    await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
      redirect: 'manual',
      mode: 'no-cors',
    });
    const latencyMs = Math.round(performance.now() - start);
    // no-cors returns opaque response on success — treat as reachable
    return { tcpConnected: true, tlsSucceeded: true, latencyMs };
  } catch (fetchErr) {
    const latencyMs = Math.round(performance.now() - start);
    if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
      return { tcpConnected: false, tlsSucceeded: false, latencyMs };
    }
    return { tcpConnected: false, tlsSucceeded: false, latencyMs };
  }
}

/**
 * Run the full browser probe for a domain and submit to the API.
 * Returns the probe result (for display) and submits anonymously.
 */
export async function runBrowserProbe(
  domain: string,
  apiBaseUrl: string = '/api'
): Promise<BrowserProbeResult> {
  const asnInfo = await detectASN();
  const probe = await probeDomain(domain);

  const report: BrowserProbeResult = {
    domain,
    tcpConnected: probe.tcpConnected,
    tlsSucceeded: probe.tlsSucceeded,
    httpStatus: probe.httpStatus,
    latencyMs: probe.latencyMs,
    asn: asnInfo?.asn,
    isp: mapISP(asnInfo?.isp),
    timestamp: new Date().toISOString(),
  };

  // Fire-and-forget submission
  fetch(`${apiBaseUrl}/browser/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
    keepalive: true,
  }).catch(() => {});

  return report;
}
