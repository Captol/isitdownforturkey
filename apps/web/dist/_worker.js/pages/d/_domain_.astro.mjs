globalThis.process ??= {}; globalThis.process.env ??= {};
import { e as createAstro, f as createComponent, m as maybeRenderHead, h as addAttribute, r as renderTemplate, k as renderComponent } from '../../chunks/astro/server_KeCo5y3E.mjs';
import { t, s as strings, d as detectLang, $ as $$Layout } from '../../chunks/Layout_CjGm0Oeb.mjs';
/* empty css                                       */
export { renderers } from '../../renderers.mjs';

const $$Astro$4 = createAstro("https://isitdownforturkey.pages.dev");
const $$VerdictBadge = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$VerdictBadge;
  const { verdict, blockReason, lang, confidence } = Astro2.props;
  const verdictClass = verdict === "UP" ? "dot-up" : verdict === "BLOCKED" ? "dot-blocked" : verdict === "DOWN_GLOBALLY" || verdict === "DEGRADED" ? "dot-down" : "dot-unknown";
  const label = t(lang, `verdict${verdict}`) ?? verdict;
  return renderTemplate`${maybeRenderHead()}<span${addAttribute(`verdict-badge ${verdictClass}`, "class")}${addAttribute(label, "aria-label")} data-astro-cid-e7lq3wsu> <span class="verdict-dot" aria-hidden="true" data-astro-cid-e7lq3wsu></span> ${label} ${blockReason && renderTemplate`<span class="verdict-reason" data-astro-cid-e7lq3wsu>
— ${t(lang, `blockReason${blockReason.replace("_", "")}`) ?? blockReason} </span>`} </span> `;
}, "C:/Users/\u0130brahim/Desktop/Deney/apps/web/src/components/VerdictBadge.astro", void 0);

const $$Astro$3 = createAstro("https://isitdownforturkey.pages.dev");
const $$ISPGrid = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$ISPGrid;
  const { breakdown, lang } = Astro2.props;
  const ISPs = [
    "turk-telekom",
    "turkcell-superonline",
    "turknet",
    "vodafone-tr",
    "tursat-kablonet",
    "other"
  ];
  function ispClass(verdict) {
    if (verdict === "UP") return "isp-up";
    if (verdict === "BLOCKED") return "isp-blocked";
    if (verdict === "DEGRADED") return "isp-degraded";
    return "isp-unknown";
  }
  return renderTemplate`${maybeRenderHead()}<div class="isp-grid" role="table"${addAttribute(t(lang, "ispBreakdown"), "aria-label")} data-astro-cid-gayp6rpg> <div class="isp-header" role="rowgroup" data-astro-cid-gayp6rpg> <div class="isp-col-name" role="columnheader" data-astro-cid-gayp6rpg>${lang === "tr" ? "ISP" : "ISP"}</div> <div class="isp-col-verdict" role="columnheader" data-astro-cid-gayp6rpg>${t(lang, "verdictUp").split(" ")[0]} / ${t(lang, "verdictBlocked").split(" ")[0]}</div> <div class="isp-col-probes" role="columnheader" data-astro-cid-gayp6rpg>Probes</div> </div> ${ISPs.map((isp) => {
    const row = breakdown[isp] ?? { verdict: "UNKNOWN", probeCount: 0};
    const label = strings[lang][isp] ?? isp;
    return renderTemplate`<div${addAttribute(`isp-row ${ispClass(row.verdict)}`, "class")} role="row" data-astro-cid-gayp6rpg> <div class="isp-name" role="cell" data-astro-cid-gayp6rpg>${label}</div> <div class="isp-verdict" role="cell" data-astro-cid-gayp6rpg> <span${addAttribute(`isp-dot ${ispClass(row.verdict)}`, "class")}${addAttribute(row.verdict, "aria-label")} data-astro-cid-gayp6rpg></span> ${row.verdict} </div> <div class="isp-probes" role="cell" data-astro-cid-gayp6rpg>${row.probeCount}</div> </div>`;
  })} </div> `;
}, "C:/Users/\u0130brahim/Desktop/Deney/apps/web/src/components/ISPGrid.astro", void 0);

const $$Astro$2 = createAstro("https://isitdownforturkey.pages.dev");
const $$BrowserCheck = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$BrowserCheck;
  const { domain, apiBase, lang } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div class="browser-check" client:load data-astro-cid-tljyg2n5> <button class="browser-check-btn" id="browser-check-btn"${addAttribute(() => {
    import('../../chunks/browser-probe_BZ4bCJVS.mjs').then(async ({ runBrowserProbe }) => {
      const btn = document.getElementById("browser-check-btn");
      if (btn) btn.disabled = true;
      const result = await runBrowserProbe(domain, apiBase);
      const statusEl = document.getElementById("browser-check-status");
      if (statusEl) {
        if (result.tcpConnected && result.tlsSucceeded) {
          statusEl.innerHTML = `<span class="browser-ok">${lang === "tr" ? "\u2713 Eri\u015Filebilir (taray\u0131c\u0131dan)" : "\u2713 Reachable (from browser)"}</span>`;
        } else {
          statusEl.innerHTML = `<span class="browser-fail">${lang === "tr" ? "\u2717 Eri\u015Filemiyor (taray\u0131c\u0131dan)" : "\u2717 Not reachable (from browser)"}</span>`;
        }
      }
    });
  }, "onclick")} data-astro-cid-tljyg2n5> ${lang === "tr" ? "\u{1F310} Taray\u0131c\u0131dan kontrol et" : "\u{1F310} Check from your browser"} </button> <div id="browser-check-status" class="browser-check-status" data-astro-cid-tljyg2n5></div> </div> `;
}, "C:/Users/\u0130brahim/Desktop/Deney/apps/web/src/components/BrowserCheck.astro", void 0);

const $$Astro$1 = createAstro("https://isitdownforturkey.pages.dev");
const $$HistoryChart = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$HistoryChart;
  const { domain, hours, lang } = Astro2.props;
  const apiBase = "/api";
  let chartData = [];
  let chartError = null;
  try {
    const resp = await fetch(`${apiBase}/history/${encodeURIComponent(domain)}?hours=${hours}`, {
      signal: AbortSignal.timeout(5e3)
    });
    if (resp.ok) {
      const data = await resp.json();
      chartData = data.chartData;
    }
  } catch {
    chartError = lang === "tr" ? "Grafik yüklenemedi" : "Could not load chart";
  }
  return renderTemplate`${chartData.length > 0 && renderTemplate`${maybeRenderHead()}<section class="history-chart" data-astro-cid-c22tbghg><h2 data-astro-cid-c22tbghg>${lang === "tr" ? `Son ${hours} saat` : `Last ${hours} hours`}</h2><div class="chart-legend" data-astro-cid-c22tbghg><span class="legend-up" data-astro-cid-c22tbghg>${lang === "tr" ? "Erişilebilir" : "Up"}</span><span class="legend-blocked" data-astro-cid-c22tbghg>${lang === "tr" ? "Engellenmiş" : "Blocked"}</span><span class="legend-down" data-astro-cid-c22tbghg>${lang === "tr" ? "Açık/ Bilinmiyor" : "Down/Unknown"}</span></div><svg class="chart-svg"${addAttribute(`0 0 ${Math.max(chartData.length * 3, 200)} ${120}`, "viewBox")} preserveAspectRatio="xMidYMid meet" role="img"${addAttribute(`${domain} reachability chart, last ${hours} hours`, "aria-label")} data-astro-cid-c22tbghg>${chartData.map((point, i) => {
    const x = i * 3 + 1;
    const total = point.up + point.blocked + point.down;
    const hUp = total > 0 ? point.up / total * 80 : 0;
    const hBlocked = total > 0 ? point.blocked / total * 80 : 0;
    const hDown = total > 0 ? point.down / total * 80 : 0;
    const yBase = 100;
    return renderTemplate`<g${addAttribute(point.hour, "key")}${addAttribute(`${point.hour}: ↑${point.up} 🚫${point.blocked} ↓${point.down}${point.avgLatency !== null ? ` ${point.avgLatency}ms` : ""}`, "title")} data-astro-cid-c22tbghg>${hUp > 0 && renderTemplate`<rect${addAttribute(x, "x")}${addAttribute(yBase - hUp, "y")} width="2"${addAttribute(hUp, "height")} fill="#22c55e" rx="1" data-astro-cid-c22tbghg></rect>`}${hBlocked > 0 && renderTemplate`<rect${addAttribute(x, "x")}${addAttribute(yBase - hUp - hBlocked, "y")} width="2"${addAttribute(hBlocked, "height")} fill="#ef4444" rx="1" data-astro-cid-c22tbghg></rect>`}${hDown > 0 && renderTemplate`<rect${addAttribute(x, "x")}${addAttribute(yBase - hUp - hBlocked - hDown, "y")} width="2"${addAttribute(hDown, "height")} fill="#6b7280" rx="1" data-astro-cid-c22tbghg></rect>`}</g>`;
  })}</svg><p class="chart-note" data-astro-cid-c22tbghg>${lang === "tr" ? "Her çubuk 1 saati temsil eder" : "Each bar represents 1 hour"}</p></section>`}${chartError && renderTemplate`<p class="chart-error" data-astro-cid-c22tbghg>${chartError}</p>`}`;
}, "C:/Users/İbrahim/Desktop/Deney/apps/web/src/components/HistoryChart.astro", void 0);

const $$Astro = createAstro("https://isitdownforturkey.pages.dev");
const prerender = false;
const $$domain = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$domain;
  const { domain } = Astro2.props;
  const lang = detectLang(Astro2.request.headers);
  const apiBase = "/api";
  let json = null;
  let error = null;
  try {
    const resp = await fetch(`${apiBase}/check?domain=${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(8e3)
    });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    json = await resp.json();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }
  const pageTitle = `${domain} — ${t(lang, "heroTitle")}`;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": pageTitle, "lang": lang, "description": `${domain}: ${json?.verdict ?? "checking..."}`, "data-astro-cid-snbcsirc": true }, { "default": async ($$result2) => renderTemplate`${error ? renderTemplate`${maybeRenderHead()}<section class="error-state" data-astro-cid-snbcsirc> <h2 data-astro-cid-snbcsirc>${t(lang, "verdictUnknown")}</h2> <p data-astro-cid-snbcsirc>${error}</p> </section>` : json ? renderTemplate`<div data-astro-cid-snbcsirc> <section class="result-hero" data-astro-cid-snbcsirc> <h1 class="domain-title" data-astro-cid-snbcsirc>${domain}</h1> ${renderComponent($$result2, "VerdictBadge", $$VerdictBadge, { "verdict": json.verdict, "blockReason": json.blockReason, "lang": lang, "data-astro-cid-snbcsirc": true })} <p class="meta" data-astro-cid-snbcsirc> <span class="confidence-pill" data-astro-cid-snbcsirc>${t(lang, "confidence" + json.confidence.charAt(0).toUpperCase() + json.confidence.slice(1))}</span> <span class="last-checked" data-astro-cid-snbcsirc> ${t(lang, "lastChecked")}: ${new Date(json.lastAggregated).toLocaleString(lang === "tr" ? "tr-TR" : "en-US")} </span> </p> </section> ${json.globalBaseline && renderTemplate`<section class="baseline-card" data-astro-cid-snbcsirc> <h2 data-astro-cid-snbcsirc>${t(lang, "globalBaseline")}</h2> <dl class="baseline-dl" data-astro-cid-snbcsirc> <dt data-astro-cid-snbcsirc>${lang === "tr" ? "DNS çözüldü mü?" : "DNS resolved?"}</dt> <dd data-astro-cid-snbcsirc>${json.globalBaseline.dnsResolved ? "✅" : "❌"}</dd> <dt data-astro-cid-snbcsirc>${lang === "tr" ? "HTTPS erişilebilir mi?" : "HTTPS reachable?"}</dt> <dd data-astro-cid-snbcsirc>${json.globalBaseline.httpsReachable ? "✅" : "❌"}</dd> <dt data-astro-cid-snbcsirc>${lang === "tr" ? "Gecikme" : "Latency"}</dt> <dd data-astro-cid-snbcsirc>${json.globalBaseline.latencyMs} ms</dd> </dl> </section>`} <section class="isp-section" data-astro-cid-snbcsirc> <h2 data-astro-cid-snbcsirc>${t(lang, "ispBreakdown")}</h2> ${renderComponent($$result2, "ISPGrid", $$ISPGrid, { "breakdown": json.ispBreakdown, "lang": lang, "data-astro-cid-snbcsirc": true })} </section> ${renderComponent($$result2, "BrowserCheck", $$BrowserCheck, { "domain": domain, "apiBase": apiBase, "lang": lang, "data-astro-cid-snbcsirc": true })} ${renderComponent($$result2, "HistoryChart", $$HistoryChart, { "domain": domain, "hours": 24, "lang": lang, "data-astro-cid-snbcsirc": true })} </div>` : renderTemplate`<section class="loading" data-astro-cid-snbcsirc><p data-astro-cid-snbcsirc>${lang === "tr" ? "Kontrol ediliyor..." : "Checking..."}</p></section>`}` })} `;
}, "C:/Users/İbrahim/Desktop/Deney/apps/web/src/pages/d/[domain].astro", void 0);
const $$file = "C:/Users/İbrahim/Desktop/Deney/apps/web/src/pages/d/[domain].astro";
const $$url = "/d/[domain]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$domain,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
