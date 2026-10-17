/**
 * Block-page fingerprint detection for Turkish ISP/BTK censorship.
 *
 * Identifies known block signatures from Turkish ISPs and court orders
 * under Law No. 5651.
 */

/**
 * Known sinkhole/re-direction IP ranges used by Turkish ISPs.
 */
export const KNOWN_BLOCK_IP_RANGES = [
  // Türk Telekom sinkhole
  { cidr: '195.175.0.0/16', note: 'TT sinkhole' },
  // Turkcell Superonline (varies)
  { cidr: '195.175.0.0/16', note: 'Superonline redirect' },
];

/**
 * BTK court decision block page indicators (HTML title/text patterns).
 * Source: Publicly documented Law No. 5651 block pages.
 */
export const BTK_BLOCK_PATTERNS = {
  titles: [
    /5651 sayılı\s*kanaat/i,
    /5651\s*sayılı\s*kanun/i,
    /adli\s*müdahale/i,
    /btk\s*block/i,
    /ulusal\s*haber\s*merkezi/i,
    /internet\s*engelleme/i,
    /site\s*engellenmiştir/i,
    /erşat\s*engeli/i,
    /mahkeme\s*kararı/i,
  ],
  bodyPatterns: [
    /cumhuriyet\s*başsavcılığı/i,
    /adli\s*kontrol/i,
    /erişim\s*engellenmiştir/i,
    /yasaklanmıştır/i,
    /mahkeme\s*kararı\s*gereğince/i,
  ],
  // Known ISP block page HTML fragments
  htmlSignatures: [
    '<title>5651 Sayılı Kanun',
    'Adli Müdahale',
    'Erişim Engellenmiştir',
    'İnternet Engelleme',
  ],
};

/**
 * Known SNI reset indicators — when TLS handshake fails with specific errors.
 */
export const SNI_RESET_INDICATORS = [
  'tls_protocol_error',
  'handshake_failure',
  'bad_certificate',
  'certificate_unknown',
] as const;

/**
 * Analyze a DNS resolution result to detect poisoning/sinkholing.
 * Returns the block reason if detected, null otherwise.
 */
export function detectDNSPoisoning({
  systemDns,
  dohCloudflare,
  dohGoogle,
}: {
  systemDns?: string[] | null;
  dohCloudflare?: string[] | null;
  dohGoogle?: string[] | null;
}): 'dns_poisoning' | null {
  // If system DNS differs from DoH, and system returns sinkhole IPs
  if (!systemDns?.length || !dohCloudflare?.length) {
    return null;
  }

  const systemSet = new Set(systemDns);
  const dohSet = new Set(dohCloudflare);

  // If system has IPs that DoH doesn't, and they match sinkhole ranges
  for (const ip of systemDns) {
    if (dohSet.has(ip)) continue;

    // Check if it's a known sinkhole IP
    if (ip.startsWith('195.175.') || ip === '0.0.0.0' || ip === '127.0.0.1') {
      return 'dns_poisoning';
    }
  }

  return null;
}

/**
 * Analyze an HTTP response for BTK block page signatures.
 */
export function detectBlockPage({
  htmlTitle,
  responseBody,
  headers,
}: {
  htmlTitle?: string;
  responseBody?: string;
  headers?: Record<string, string>;
}): 'http_block_page' | null {
  const title = htmlTitle?.toLowerCase() ?? '';
  const body = responseBody?.toLowerCase() ?? '';

  // Check title patterns
  for (const pattern of BTK_BLOCK_PATTERNS.titles) {
    if (pattern.test(title)) return 'http_block_page';
  }

  // Check body patterns
  for (const pattern of BTK_BLOCK_PATTERNS.bodyPatterns) {
    if (pattern.test(body)) return 'http_block_page';
  }

  // Check raw HTML signatures (case-insensitive)
  const fullText = `${title} ${body}`;
  for (const sig of BTK_BLOCK_PATTERNS.htmlSignatures) {
    if (fullText.includes(sig.toLowerCase())) return 'http_block_page';
  }

  return null;
}

/**
 * Main fingerprint analysis — given probe results, determine the blocking method.
 */
export function analyzeBlockMethod({
  systemDns,
  dohCloudflare,
  dohGoogle,
  tcpConnected,
  tlsSucceeded,
  httpStatus,
  htmlTitle,
  responseBody,
}: {
  systemDns?: string[] | null;
  dohCloudflare?: string[] | null;
  dohGoogle?: string[] | null;
  tcpConnected: boolean;
  tlsSucceeded: boolean;
  httpStatus?: number;
  htmlTitle?: string;
  responseBody?: string;
}): 'dns_poisoning' | 'sni_reset' | 'http_block_page' | 'ip_block' | null {
  // Check DNS poisoning first
  const dnsPoison = detectDNSPoisoning({ systemDns, dohCloudflare, dohGoogle });
  if (dnsPoison) return dnsPoison;

  // Check TCP connection
  if (!tcpConnected) return 'ip_block';

  // Check TLS
  if (tcpConnected && !tlsSucceeded) return 'sni_reset';

  // Check HTTP block page
  if (tcpConnected && tlsSucceeded && httpStatus !== undefined) {
    const blockPage = detectBlockPage({ htmlTitle, responseBody });
    if (blockPage) return blockPage;
  }

  return null;
}

// ─── Self-tests ─────────────────────────────────────────────────────────────

export function runFingerprintTests(): void {
  const tests = [
    // DNS poisoning detection
    {
      name: 'DNS poisoning - system returns sinkhole',
      input: { systemDns: ['195.175.10.10'], dohCloudflare: ['93.184.216.34'] },
      expected: 'dns_poisoning',
    },
    {
      name: 'DNS poisoning - system returns 0.0.0.0',
      input: { systemDns: ['0.0.0.0'], dohCloudflare: ['93.184.216.34'] },
      expected: 'dns_poisoning',
    },
    {
      name: 'No poisoning - DNS matches',
      input: { systemDns: ['93.184.216.34'], dohCloudflare: ['93.184.216.34'] },
      expected: null,
    },
    // Block page detection
    {
      name: 'Block page - BTK title',
      input: { htmlTitle: '5651 Sayılı Kanun Kapsamında' },
      expected: 'http_block_page',
    },
    {
      name: 'No block page',
      input: { htmlTitle: 'OpenAI' },
      expected: null,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const { name, input, expected } = test;
    let actual: string | null = null;

    if ('systemDns' in input) {
      actual = detectDNSPoisoning(input as Parameters<typeof detectDNSPoisoning>[0]);
    } else if ('htmlTitle' in input) {
      actual = detectBlockPage(input as Parameters<typeof detectBlockPage>[0]);
    }

    if (actual === expected) {
      passed++;
    } else {
      console.error(`FAIL: ${name} = ${actual}, expected ${expected}`);
      failed++;
    }
  }

  console.log(`Fingerprint Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

export const fingerprintExports = { detectDNSPoisoning, detectBlockPage, analyzeBlockMethod };
