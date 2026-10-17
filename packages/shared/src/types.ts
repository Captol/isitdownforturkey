/**
 * Core type definitions for isitdownforturkey.
 */

export type Verdict = 'UP' | 'BLOCKED' | 'DOWN_GLOBALLY' | 'DEGRADED' | 'UNKNOWN';
export type BlockReason = 'dns_poisoning' | 'sni_reset' | 'ip_block' | 'http_block_page';

export type TurkishISP =
  | 'turk-telekom'
  | 'turkcell-superonline'
  | 'turknet'
  | 'vodafone-tr'
  | 'tursat-kablonet'
  | 'other';

export const ISP_METADATA: Record<TurkishISP, { labelTR: string; labelEN: string; asn?: string }> = {
  'turk-telekom': { labelTR: 'Türk Telekom', labelEN: 'Turk Telekom', asn: 'AS9121' },
  'turkcell-superonline': { labelTR: 'Turkcell Süperonline', labelEN: 'Turkcell Superonline', asn: 'AS34984' },
  'turknet': { labelTR: 'TurkNet', labelEN: 'TurkNet', asn: 'AS12735' },
  'vodafone-tr': { labelTR: 'Vodafone TR', labelEN: 'Vodafone TR', asn: 'AS15897' },
  'tursat-kablonet': { labelTR: 'Türksat / Kablonet', labelEN: 'Tursat / Kablonet', asn: 'AS47524' },
  'other': { labelTR: 'Diğer', labelEN: 'Other', asn: undefined },
};

export interface ProbeResult {
  domain: string;
  isp: TurkishISP;
  asn: number;
  dnsResult?: { system: string[] | null; dohCloudflare: string[] | null; dohGoogle: string[] | null };
  tcpConnected: boolean;
  tlsSucceeded: boolean;
  httpStatus?: number;
  blockReason?: BlockReason;
  latencyMs: number;
  timestamp: string;
}

export interface GlobalBaseline {
  domain: string;
  dnsResolved: boolean;
  cfDnsRecords?: string[];
  googleDnsRecords?: string[];
  httpsReachable: boolean;
  httpStatus?: number;
  latencyMs: number;
  timestamp: string;
}

export interface BrowserProbeResult {
  domain: string;
  timestamp: string;
  tcpConnected: boolean;
  tlsSucceeded: boolean;
  httpStatus?: number;
  latencyMs: number;
  asn?: number;
  isp?: TurkishISP;
}

export interface CheckResponse {
  domain: string;
  verdict: Verdict;
  blockReason?: BlockReason;
  confidence: 'high' | 'medium' | 'low' | 'none';
  globalBaseline: GlobalBaseline | null;
  ispBreakdown: Record<TurkishISP, { verdict: Verdict; probeCount: number; lastChecked: string; blockReason?: BlockReason }>;
  browserProbe?: BrowserProbeResult;
  lastAggregated: string;
}

import { z } from 'zod';

export const ProbeReportSchema = z.object({
  signature: z.string().min(1),
  timestamp: z.string().datetime(),
  domain: z.string().min(1).max(253),
  probeId: z.string().min(1),
  asn: z.number().int().positive(),
  isp: z.enum(['turk-telekom','turkcell-superonline','turknet','vodafone-tr','tursat-kablonet','other']),
  systemDns: z.array(z.string()).optional(),
  dohCloudflare: z.array(z.string()).optional(),
  dohGoogle: z.array(z.string()).optional(),
  tcpLatencyMs: z.number().positive().optional(),
  tlsLatencyMs: z.number().positive().optional(),
  tlsSuccess: z.boolean().optional(),
  tcpConnected: z.boolean().optional(),
  tlsSucceeded: z.boolean().optional(),
  httpStatus: z.number().int().positive().optional(),
  httpResponseHeaders: z.record(z.string()).optional(),
  htmlTitle: z.string().optional(),
  httpLatencyMs: z.number().positive().optional(),
});

export const DomainParamSchema = z.string().min(1).max(253)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/, 'Invalid domain format');

export const BrowserProbeSchema = z.object({
  timestamp: z.string().datetime(),
  domain: z.string().min(1).max(253),
  tcpConnected: z.boolean(),
  tlsSucceeded: z.boolean(),
  httpStatus: z.number().int().positive().optional(),
  latencyMs: z.number().int().positive(),
  asn: z.number().int().positive().optional(),
  isp: z.enum(['turk-telekom','turkcell-superonline','turknet','vodafone-tr','tursat-kablonet','other']).optional(),
});
