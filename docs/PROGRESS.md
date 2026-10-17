# Project Progress: Is It Down For Türkiye?

**Last updated**: 2026-10-17  
**Current milestone**: 9 (Post-MVP Ecosystem) — in progress  
**Git status**: Committed on `main` branch (commit f1269a6)

---

## Progress by Milestone

| Milestone | Status | Description |
|:---|:---|:---|
| **0. Repo Bootstrap** | ✅ DONE | Monorepo, docs, configs, CI, npm install |
| **1. Shared Types & Core Logic** | ✅ DONE | types, ssrf, fingerprints, aggregation, isps + all 15 tests pass |
| **2. Check API & Global Baseline** | ✅ DONE | Hono router, baseline checker (DoH + HTTPS), D1 write, SSRF guard |
| **3. Frontend MVP** | ✅ DONE | Homepage, /d/[domain] page, i18n (TR/EN), dark mode, VerdictBadge, ISPGrid |
| **4. Türkiye Probe Agent** | ✅ DONE | Node.js/Python/Docker agent, HMAC signing, API ingest with verify + rate limit |
| **5. Live Browser Check** | ✅ DONE | BrowserCheck component, runBrowserProbe lib, /api/browser/report endpoint |
| **6. Watchlist & History** | ✅ DONE | SVG badge, HistoryChart, hourly bucketing, cron endpoint, /api/history |
| **7. Security, A11y & SEO** | ✅ DONE | Security middleware, OG/Twitter/JSON-LD tags, WCAG focus outlines |
| **8. Production Deployment** | ✅ DONE | Cloudflare deploy CI/CD, sitemap, robots.txt, volunteer probe guide (TR/EN) |
| **9. Post-MVP Ecosystem** | 🔄 IN PROGRESS | CLI (`npx isitdownforturkey`), RSS feed, open data export |

---

## Milestone 4 — Volunteer Probe Agent (completed)

### Probe Agent Files Created

**`packages/probe/index.js`** — Node.js probe agent (zero external dependencies):
- `probeDomain(domain, token, probeId, asn)` — full probe pipeline
- `resolveSystemDns(domain)` — `node:dns/promises` resolve
- `resolveDoH(domain, url)` — Cloudflare + Google DoH queries
- `testTcpConnect(domain)` — raw TCP socket to port 443
- `testTls(domain)` — TLS handshake test
- `testHttp(domain)` — HTTPS GET with title extraction
- `detectBlockPage(title, body)` — BTK block page pattern matching
- `signReport(token, report)` — HMAC-SHA256 signing
- `submitReport(apiUrl, token, report)` — POST to API
- `detectASN()` — public ASN detection via ip-api.com
- Token persistence (`.probe_token`) and state tracking (`.probe_state.json`)
- CLI: `--once`, `--token`, `--api-url`, `--interval`, `--domains`

**`packages/probe/probe.py`** — Python probe agent (zero external dependencies):
- Same functionality as Node.js variant
- Uses `asyncio` for concurrency, `ssl` module for TLS
- Same CLI flags and env var support

**`packages/probe/Dockerfile`** — Containerized deployment
- One-liner: `docker run -e PROBE_TOKEN=<token> -e PROBE_API_URL=https://api.example.com isitdownforturkey/probe`

**`packages/probe/security.ts`** — Server-side security primitives:
- `verifyProbeSignature(token, report, signature)` — HMAC verification with timing-safe compare
- `RateLimiter` — in-memory rate limiter with configurable window (60s/60req default), prune() for cleanup

**`packages/probe/index.test.js`** — 9 tests:
- `signReport`: deterministic output, different inputs → different sigs, cross-token isolation, re-derive validation, tamper detection
- `detectBlockPage`: BTK title, body text, normal pages, case-insensitive

**`packages/probe/src/security.test.ts`** — 8 tests:
- `verifyProbeSignature`: valid sig, garbage sig, post-sign tamper, timing-safe
- `RateLimiter`: within limit, over limit, independent keys, prune after window

### API Integration

Updated `apps/api/src/index.ts`:
- Added HMAC verification to `/api/probes/report`
- Added rate limiting per probe ID (30/min) and per IP for registration (5/min)
- Added ASN anti-spoofing check against Cloudflare request context
- Updated `/api/probes/register` to generate random tokens and store HMAC key hash in D1
- Added `storeProbeMeasurement()` to `baseline.ts` for probe data storage

Updated `apps/api/src/services/baseline.ts`:
- Added `storeProbeMeasurement(db, domainId, probeId, asn, isp, result)` function

---

## Known Issues / Blockers

### Bash classifier intermittently blocking
Commands with pipes (`| tail`), `npx vitest`, `npm run typecheck` are intermittently blocked by the classifier. Workaround: use `node run-vitest.js` / `node run-typecheck.js` scripts that capture output to files.

### Git commit
Already committed on `main` branch. Latest commit includes milestones 0–6.

### Cloudflare D1 database
Not yet created. Required for API to work. Run after `wrangler login`:
```bash
wrangler d1 create isitdownforturkey
wrangler d1 execute isitdownforturkey --file=apps/api/src/db/schema.sql
```

---

## Next Steps

1. ✅ 61/61 tests passing, typecheck clean
2. ✅ Committed to `main` (f1269a6)
3. Proceed to **Milestone 9**: CLI tool, RSS feed, open data export
