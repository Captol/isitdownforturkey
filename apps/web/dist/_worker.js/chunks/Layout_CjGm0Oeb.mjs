globalThis.process ??= {}; globalThis.process.env ??= {};
import { e as createAstro, f as createComponent, h as addAttribute, l as renderScript, n as renderHead, o as renderSlot, r as renderTemplate } from './astro/server_KeCo5y3E.mjs';

const strings = {
  tr: {
    siteTitle: "Türkiye'den Açılıyor mu?",
    siteSubtitle: "Türkiye'den erişilebilirlik kontrol aracı",
    searchLabel: "Alan adı",
    searchPlaceholder: "example.com",
    searchButton: "Kontrol Et",
    heroTitle: "Site Türkiye'den erişilebilir mi?",
    heroDesc: "Herhangi bir alan adı girin ve Türkiye ISPleri üzerinden erişilebilirliğini anlık olarak kontrol edin.",
    verdictUp: "Çalışıyor",
    verdictBlocked: "Engellenmiş",
    verdictDownGlobally: "Globalde Çökük",
    verdictDegraded: "Bozulmuş",
    verdictUnknown: "Bilinmiyor",
    confidenceHigh: "Yüksek güven",
    confidenceMedium: "Orta güven",
    confidenceLow: "Düşük güven",
    confidenceNone: "Veri yok",
    blockReasonDNS: "DNS zehirleme",
    blockReasonSNI: "SNI sıfırlama",
    blockReasonIP: "IP engeli",
    blockReasonHTTP: "HTTP engel sayfası",
    lastChecked: "Son kontrol",
    globalBaseline: "Global durum",
    ispBreakdown: "ISP bazlı durum",
    home: "Ana sayfa",
    github: "GitHub",
    footerText: "Isitdownforturkey — Türkiyeden erişilebilirlik monitörü",
    footerLink: "GitHubda kaynak kod",
    watchlistTitle: "Takip edilen servisler",
    watchlistDesc: "Popüler servislerin Türkiye durumunu hızlıca kontrol edin."
  },
  en: {
    siteTitle: "Is It Down For Türkiye?",
    siteSubtitle: "Reachability check tool from Türkiye",
    searchLabel: "Domain",
    searchPlaceholder: "example.com",
    searchButton: "Check",
    heroTitle: "Is this site reachable from Türkiye?",
    heroDesc: "Enter any domain to check its real-time reachability across Turkish ISPs.",
    verdictUp: "UP",
    verdictBlocked: "BLOCKED",
    verdictDownGlobally: "DOWN GLOBALLY",
    verdictDegraded: "DEGRADED",
    verdictUnknown: "UNKNOWN",
    confidenceHigh: "High confidence",
    confidenceMedium: "Medium confidence",
    confidenceLow: "Low confidence",
    confidenceNone: "No data",
    blockReasonDNS: "DNS poisoning",
    blockReasonSNI: "SNI reset",
    blockReasonIP: "IP block",
    blockReasonHTTP: "HTTP block page",
    lastChecked: "Last checked",
    globalBaseline: "Global baseline",
    ispBreakdown: "ISP breakdown",
    home: "Home",
    github: "GitHub",
    footerText: "Is It Down For Türkiye — Türkiye reachability monitor",
    footerLink: "Source on GitHub",
    watchlistTitle: "Watchlisted services",
    watchlistDesc: "Quickly check the status of popular services in Türkiye."
  }
};
function t(lang, key) {
  return strings[lang][key];
}
function detectLang(headers) {
  const accept = headers.get("accept-language") ?? "";
  return accept.includes("tr") ? "tr" : "en";
}

const $$Astro = createAstro("https://isitdownforturkey.pages.dev");
const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Layout;
  const { title, lang = "tr", description } = Astro2.props;
  const L = t(lang, "siteTitle");
  return renderTemplate`<html${addAttribute(lang, "lang")}${addAttribute(lang === "tr" ? "ltr" : "ltr", "dir")}> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description"${addAttribute(description ?? t(lang, "heroDesc"), "content")}><meta name="theme-color" content="#f97316"><link rel="stylesheet" href="/css/base.css"><title>${title} — ${L}</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta property="og:type" content="website"><meta property="og:title"${addAttribute(`${title} \u2014 ${L}`, "content")}><meta property="og:description"${addAttribute(description ?? t(lang, "heroDesc"), "content")}><meta property="og:locale"${addAttribute(lang === "tr" ? "tr_TR" : "en_US", "content")}><meta name="twitter:card" content="summary"><meta name="twitter:title"${addAttribute(`${title} \u2014 ${L}`, "content")}><meta name="twitter:description"${addAttribute(description ?? t(lang, "heroDesc"), "content")}>${renderScript($$result, "C:/Users/\u0130brahim/Desktop/Deney/apps/web/src/layouts/Layout.astro?astro&type=script&index=0&lang.ts")}${renderHead()}</head> <body> <a href="#main" class="skip-link">${t(lang, "home")}</a> <header class="site-header"> <div class="container"> <a href="/" class="logo"> <span aria-hidden="true">🇹🇷</span> <span>${L}</span> </a> <nav aria-label="Primary"> <a href="/">${t(lang, "home")}</a> <a href="https://github.com/isitdownforturkey/isitdownforturkey" target="_blank" rel="noopener noreferrer">${t(lang, "github")}</a> </nav> </div> </header> <main id="main" class="container"> ${renderSlot($$result, $$slots["default"])} </main> <footer class="site-footer"> <div class="container"> <p>${t(lang, "footerText")}</p> <p><a href="https://github.com/isitdownforturkey/isitdownforturkey" target="_blank" rel="noopener noreferrer">${t(lang, "footerLink")}</a></p> </div> </footer> </body></html>`;
}, "C:/Users/\u0130brahim/Desktop/Deney/apps/web/src/layouts/Layout.astro", void 0);

export { $$Layout as $, detectLang as d, strings as s, t };
