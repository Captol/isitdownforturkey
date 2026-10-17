globalThis.process ??= {}; globalThis.process.env ??= {};
async function detectASN() {
  try {
    const resp = await fetch("http://ip-api.com/json/?fields=ip,as,org", {
      signal: AbortSignal.timeout(5e3)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.ip) return null;
    const asnMatch = data.as?.match(/AS(\d+)/);
    return {
      ip: data.ip,
      asn: asnMatch ? parseInt(asnMatch[1], 10) : void 0,
      isp: data.org ?? void 0
    };
  } catch {
    return null;
  }
}
function mapISP(ispName) {
  if (!ispName) return void 0;
  const name = ispName.toLowerCase();
  if (name.includes("turk telekom") || name.includes("tt") || name.includes("tcom")) return "turk-telekom";
  if (name.includes("turkcell") || name.includes("superonline")) return "turkcell-superonline";
  if (name.includes("turknet")) return "turknet";
  if (name.includes("vodafone")) return "vodafone-tr";
  if (name.includes("tursat") || name.includes("kablonet")) return "tursat-kablonet";
  return "other";
}
async function probeDomain(domain) {
  const url = `https://${domain}/`;
  const start = performance.now();
  try {
    await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8e3),
      redirect: "manual",
      mode: "no-cors"
    });
    const latencyMs = Math.round(performance.now() - start);
    return { tcpConnected: true, tlsSucceeded: true, latencyMs };
  } catch (fetchErr) {
    const latencyMs = Math.round(performance.now() - start);
    if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
      return { tcpConnected: false, tlsSucceeded: false, latencyMs };
    }
    return { tcpConnected: false, tlsSucceeded: false, latencyMs };
  }
}
async function runBrowserProbe(domain, apiBaseUrl = "/api") {
  const asnInfo = await detectASN();
  const probe = await probeDomain(domain);
  const report = {
    domain,
    tcpConnected: probe.tcpConnected,
    tlsSucceeded: probe.tlsSucceeded,
    httpStatus: probe.httpStatus,
    latencyMs: probe.latencyMs,
    asn: asnInfo?.asn,
    isp: mapISP(asnInfo?.isp),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  fetch(`${apiBaseUrl}/browser/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
    keepalive: true
  }).catch(() => {
  });
  return report;
}

export { runBrowserProbe };
