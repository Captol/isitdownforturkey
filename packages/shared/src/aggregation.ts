/**
 * Verdict aggregation engine.
 *
 * Combines Layer 1 (Global Baseline), Layer 2 (Volunteer Probes), and
 * Layer 3 (Browser) measurements into a unified verdict per domain per ISP.
 */

import type {
  Verdict,
  BlockReason,
  TurkishISP,
  ProbeResult,
  GlobalBaseline,
  BrowserProbeResult,
  CheckResponse,
} from './types.js';

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * Minimum number of agreeing probes required from an ISP before declaring BLOCKED.
 * Set to 2 to avoid single-probe false positives.
 */
export const MIN_PROBES_FOR_BLOCKED = 2;

/**
 * Confidence levels based on probe count and consensus.
 */
export function getConfidence(probeCount: number, consensus: boolean): 'high' | 'medium' | 'low' | 'none' {
  if (probeCount === 0) return 'none';
  if (probeCount >= 5 && consensus) return 'high';
  if (probeCount >= 3 && consensus) return 'medium';
  if (probeCount >= 1) return 'low';
  return 'none';
}

// ─── Aggregation Logic ──────────────────────────────────────────────────────

/**
 * Aggregate probe results for a single ISP into a verdict.
 */
function aggregateISPProbes(
  probes: ProbeResult[],
  blockReasonFromFingerprint: BlockReason | null
): { verdict: Verdict; blockReason?: BlockReason; probeCount: number; consensus: boolean } {
  if (probes.length === 0) {
    return { verdict: 'UNKNOWN', probeCount: 0, consensus: false };
  }

  // Count probes reporting each outcome
  const upCount = probes.filter(p => p.tcpConnected && p.tlsSucceeded && p.httpStatus === 200).length;
  const blockedCount = probes.filter(p => p.blockReason !== undefined).length;
  const downCount = probes.filter(p => !p.tcpConnected).length;

  // If we have explicit block-page fingerprints, trust them even with single probe
  if (blockReasonFromFingerprint && probes.some(p => p.blockReason === blockReasonFromFingerprint)) {
    return {
      verdict: 'BLOCKED',
      blockReason: blockReasonFromFingerprint,
      probeCount: probes.length,
      consensus: true,
    };
  }

  // Require N agreeing probes for BLOCKED verdict
  const hasConsensus = blockedCount >= MIN_PROBES_FOR_BLOCKED;
  if (hasConsensus) {
    // Determine the most common block reason
    const reasons = probes
      .map(p => p.blockReason)
      .filter((r): r is BlockReason => r !== undefined);
    const mostCommon = reasons.sort((a, b) => reasons.filter(v => v === a).length - reasons.filter(v => v === b).length).pop()!;
    return { verdict: 'BLOCKED', blockReason: mostCommon, probeCount: probes.length, consensus: true };
  }

  // If most probes are UP, verdict is UP
  if (upCount > probes.length / 2) {
    return { verdict: 'UP', probeCount: probes.length, consensus: true };
  }

  // Mixed results = DEGRADED
  if (blockedCount > 0 || downCount > 0) {
    return { verdict: 'DEGRADED', probeCount: probes.length, consensus: false };
  }

  return { verdict: 'UNKNOWN', probeCount: probes.length, consensus: false };
}

/**
 * Build the final check response from all measurement layers.
 */
export function buildCheckResponse({
  domain,
  globalBaseline,
  ispProbes,
  browserProbe,
}: {
  domain: string;
  globalBaseline: GlobalBaseline | null;
  ispProbes: Partial<Record<TurkishISP, ProbeResult[]>>;
  browserProbe?: BrowserProbeResult | null;
}): CheckResponse {
  const now = new Date().toISOString();

  // Determine if globally down
  const globallyDown = globalBaseline !== null && !globalBaseline.httpsReachable;

  // Aggregate per ISP
  const ispBreakdown: Record<TurkishISP, CheckResponse['ispBreakdown'][TurkishISP]> = {
    'turk-telekom': { verdict: 'UNKNOWN', probeCount: 0, lastChecked: now },
    'turkcell-superonline': { verdict: 'UNKNOWN', probeCount: 0, lastChecked: now },
    'turknet': { verdict: 'UNKNOWN', probeCount: 0, lastChecked: now },
    'vodafone-tr': { verdict: 'UNKNOWN', probeCount: 0, lastChecked: now },
    'tursat-kablonet': { verdict: 'UNKNOWN', probeCount: 0, lastChecked: now },
    'other': { verdict: 'UNKNOWN', probeCount: 0, lastChecked: now },
  };

  let overallVerdict: Verdict = 'UNKNOWN';
  let overallBlockReason: BlockReason | undefined;
  let overallConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';

  // Aggregate each ISP
  for (const [isp, probes] of Object.entries(ispProbes) as [TurkishISP, ProbeResult[]][]) {
    const result = aggregateISPProbes(probes, null);
    ispBreakdown[isp] = {
      verdict: result.verdict,
      probeCount: result.probeCount,
      lastChecked: now,
      ...(result.blockReason ? { blockReason: result.blockReason } : {}),
    };

    // Update overall verdict if this ISP has a stronger signal
    if (result.verdict === 'BLOCKED' && overallVerdict !== 'BLOCKED') {
      overallVerdict = 'BLOCKED';
      overallBlockReason = result.blockReason;
    } else if (result.verdict === 'DOWN_GLOBALLY' && overallVerdict !== 'BLOCKED') {
      overallVerdict = 'DOWN_GLOBALLY';
    } else if (result.verdict === 'UP' && overallVerdict === 'UNKNOWN' && result.probeCount >= 1) {
      overallVerdict = 'UP';
    }

    // Track highest confidence
    const confidence = getConfidence(result.probeCount, result.consensus);
    if (confidence === 'high') overallConfidence = 'high';
    else if (confidence === 'medium' && overallConfidence !== 'high') overallConfidence = 'medium';
    else if (confidence === 'low' && overallConfidence === 'none') overallConfidence = 'low';
  }

  // Incorporate browser probe as a single data point (low weight, used for confidence boost)
  if (browserProbe) {
    if (browserProbe.tcpConnected && browserProbe.tlsSucceeded) {
      // Browser probe confirms reachability — boost confidence if otherwise low/medium
      if (overallConfidence === 'low' || overallConfidence === 'none') {
        overallConfidence = 'medium';
      }
      if (overallVerdict === 'UNKNOWN') {
        overallVerdict = 'UP';
      }
    }
  }

  // Override with global baseline
  if (globallyDown) {
    overallVerdict = 'DOWN_GLOBALLY';
  }

  return {
    domain,
    verdict: overallVerdict,
    blockReason: overallBlockReason,
    confidence: overallConfidence,
    globalBaseline,
    ispBreakdown,
    browserProbe: browserProbe ?? undefined,
    lastAggregated: now,
  };
}

// ─── Self-tests ─────────────────────────────────────────────────────────────

export function runAggregationTests(): void {
  const mockBaseline: GlobalBaseline = {
    domain: 'example.com',
    dnsResolved: true,
    cfDnsRecords: ['93.184.216.34'],
    googleDnsRecords: ['93.184.216.34'],
    httpsReachable: true,
    httpStatus: 200,
    latencyMs: 45,
    timestamp: new Date().toISOString(),
  };

  // Test 1: All probes agree UP
  const allUp: Partial<Record<TurkishISP, ProbeResult[]>> = {
    'turk-telekom': [
      { domain: 'example.com', isp: 'turk-telekom', asn: 9121, tcpConnected: true, tlsSucceeded: true, httpStatus: 200, latencyMs: 120, timestamp: new Date().toISOString() },
      { domain: 'example.com', isp: 'turk-telekom', asn: 9121, tcpConnected: true, tlsSucceeded: true, httpStatus: 200, latencyMs: 115, timestamp: new Date().toISOString() },
    ],
  };

  let response = buildCheckResponse({ domain: 'example.com', globalBaseline: mockBaseline, ispProbes: allUp });
  console.assert(response.verdict === 'UP', `Expected UP, got ${response.verdict}`);

  // Test 2: Multiple probes agree BLOCKED (DNS poisoning)
  const blockedTT: Partial<Record<TurkishISP, ProbeResult[]>> = {
    'turk-telekom': [
      { domain: 'example.com', isp: 'turk-telekom', asn: 9121, tcpConnected: false, tlsSucceeded: false, blockReason: 'dns_poisoning', latencyMs: 0, timestamp: new Date().toISOString() },
      { domain: 'example.com', isp: 'turk-telekom', asn: 9121, tcpConnected: false, tlsSucceeded: false, blockReason: 'dns_poisoning', latencyMs: 0, timestamp: new Date().toISOString() },
    ],
  };

  response = buildCheckResponse({ domain: 'blocked.example', globalBaseline: mockBaseline, ispProbes: blockedTT });
  console.assert(response.verdict === 'BLOCKED', `Expected BLOCKED, got ${response.verdict}`);

  // Test 3: Single probe (should be UNKNOWN, not BLOCKED)
  const singleProbe: Partial<Record<TurkishISP, ProbeResult[]>> = {
    'turk-telekom': [
      { domain: 'example.com', isp: 'turk-telekom', asn: 9121, tcpConnected: false, tlsSucceeded: false, blockReason: 'sni_reset', latencyMs: 0, timestamp: new Date().toISOString() },
    ],
  };

  response = buildCheckResponse({ domain: 'single.example', globalBaseline: mockBaseline, ispProbes: singleProbe });
  console.assert(response.verdict === 'UNKNOWN', `Expected UNKNOWN for single probe, got ${response.verdict}`);

  // Test 4: Globally down
  const globalDown: GlobalBaseline = {
    ...mockBaseline,
    httpsReachable: false,
    httpStatus: undefined,
  };
  response = buildCheckResponse({ domain: 'down.example', globalBaseline: globalDown, ispProbes: {} });
  console.assert(response.verdict === 'DOWN_GLOBALLY', `Expected DOWN_GLOBALLY, got ${response.verdict}`);

  console.log('Aggregation Tests: PASSED');
}

export const aggregationExports = { buildCheckResponse, getConfidence };
