/**
 * ISP metadata and ASN mapping for Turkish providers.
 */

import type { TurkishISP } from './types.js';

/**
 * Known Turkish ISP ASN mappings.
 * Sources: RIPE NCC, ARIN, and public BGP tables.
 */
export const TURKISH_ISP_ASNS: Record<TurkishISP, number[]> = {
  'turk-telekom': [9121],
  'turkcell-superonline': [34984, 44244],
  'turknet': [12735],
  'vodafone-tr': [15897, 61311],
  'tursat-kablonet': [47524, 55671],
  'other': [],
};

/**
 * Reverse lookup: ASN -> ISP name
 */
export function asnToISP(asn: number): TurkishISP {
  for (const [isp, asns] of Object.entries(TURKISH_ISP_ASNS)) {
    if (asns.includes(asn)) {
      return isp as TurkishISP;
    }
  }
  return 'other';
}

/**
 * Check if an ASN belongs to a Turkish ISP.
 */
export function isTurkishISP(asn: number): boolean {
  return Object.values(TURKISH_ISP_ASNS).flat().includes(asn);
}
