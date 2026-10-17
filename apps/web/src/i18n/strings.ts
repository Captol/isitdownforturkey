/**
 * Bilingual i18n strings (TR default, EN).
 * Consumed by: Layout.astro, index.astro, pages/d/[domain].astro, components/
 */
export const strings = {
  tr: {
    siteTitle: 'Türkiye\'den Açılıyor mu?',
    siteSubtitle: 'Türkiye\'den erişilebilirlik kontrol aracı',
    searchLabel: 'Alan adı',
    searchPlaceholder: 'example.com',
    searchButton: 'Kontrol Et',
    heroTitle: 'Site Türkiye\'den erişilebilir mi?',
    heroDesc: 'Herhangi bir alan adı girin ve Türkiye ISPleri üzerinden erişilebilirliğini anlık olarak kontrol edin.',
    verdictUp: 'Çalışıyor',
    verdictBlocked: 'Engellenmiş',
    verdictDownGlobally: 'Globalde Çökük',
    verdictDegraded: 'Bozulmuş',
    verdictUnknown: 'Bilinmiyor',
    confidenceHigh: 'Yüksek güven',
    confidenceMedium: 'Orta güven',
    confidenceLow: 'Düşük güven',
    confidenceNone: 'Veri yok',
    blockReasonDNS: 'DNS zehirleme',
    blockReasonSNI: 'SNI sıfırlama',
    blockReasonIP: 'IP engeli',
    blockReasonHTTP: 'HTTP engel sayfası',
    lastChecked: 'Son kontrol',
    globalBaseline: 'Global durum',
    ispBreakdown: 'ISP bazlı durum',
    home: 'Ana sayfa',
    github: 'GitHub',
    footerText: 'Isitdownforturkey — Türkiyeden erişilebilirlik monitörü',
    footerLink: 'GitHubda kaynak kod',
    watchlistTitle: 'Takip edilen servisler',
    watchlistDesc: 'Popüler servislerin Türkiye durumunu hızlıca kontrol edin.',
  },
  en: {
    siteTitle: 'Is It Down For Türkiye?',
    siteSubtitle: 'Türkiye reachability monitor',
    searchLabel: 'Domain',
    searchPlaceholder: 'example.com',
    searchButton: 'Check',
    heroTitle: 'Is this site reachable from Türkiye?',
    heroDesc: 'Enter any domain to check its real-time reachability across Turkish ISPs.',
    verdictUp: 'UP',
    verdictBlocked: 'BLOCKED',
    verdictDownGlobally: 'DOWN GLOBALLY',
    verdictDegraded: 'DEGRADED',
    verdictUnknown: 'UNKNOWN',
    confidenceHigh: 'High confidence',
    confidenceMedium: 'Medium confidence',
    confidenceLow: 'Low confidence',
    confidenceNone: 'No data',
    blockReasonDNS: 'DNS poisoning',
    blockReasonSNI: 'SNI reset',
    blockReasonIP: 'IP block',
    blockReasonHTTP: 'HTTP block page',
    lastChecked: 'Last checked',
    globalBaseline: 'Global baseline',
    ispBreakdown: 'ISP breakdown',
    home: 'Home',
    github: 'GitHub',
    footerText: 'Is It Down For Türkiye — Türkiye reachability monitor',
    footerLink: 'Source on GitHub',
    watchlistTitle: 'Watchlisted services',
    watchlistDesc: 'Quickly check the status of popular services in Türkiye.',
  },
} as const;

export type Lang = keyof typeof strings;

export function t(lang: Lang, key: keyof typeof strings[Lang]): string {
  return strings[lang][key];
}

/** Derive language from Accept-Language header (default: tr). */
export function detectLang(headers: Headers): Lang {
  const accept = headers.get('accept-language') ?? '';
  return accept.includes('en') && !accept.includes('tr') ? 'en' : 'tr';
}
