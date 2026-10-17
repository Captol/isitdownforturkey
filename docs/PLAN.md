# Master Implementation Plan: Is It Down For Türkiye? (isitdownforturkey)

## 1. Project Overview & Core Mission
**isitdownforturkey** is a free, privacy-first, community-powered public service reachability engine. It provides clear answers to whether a domain or digital service is accessible from within Türkiye, identifying the precise technical mechanism when access is impeded:
- **DNS Poisoning / Sinkholing**: System resolver returns 195.175.x.x, 0.0.0.0, or NXDOMAIN while global DoH resolves authentic records.
- **SNI / TLS Interception**: TCP connects, but TLS ClientHello with SNI triggers RST or timeout (DPI filtering).
- **IP / Routing Block**: TCP handshake times out or receives ICMP administratively prohibited on domestic routes.
- **HTTP Block Page**: HTTP response contains BTK / court order decision signatures (Law No. 5651 notices).
- **Global Outage**: Target is unreachable globally from both Cloudflare edge workers and multiple upstream resolvers.

---

## 2. Architectural Pillars ($0 Budget, Zero IP Logging)
1. **Global Baseline Layer (Cloudflare Workers + Cron)**: Runs automated checks from Cloudflare edge nodes outside Türkiye. Employs DoH to Cloudflare (1.1.1.1) and Google (8.8.8.8) to establish ground truth.
2. **Volunteer Türkiye Probe Network**: Lightweight, open-source agents (Node.js & Python) run on volunteer hardware across major Turkish ASNs (Türk Telekom AS9121, Turkcell Superonline AS34984, TurkNet AS12735, Vodafone TR AS15897, Türksat Kablonet AS47524). Uses HMAC-signed ingest, anti-spoofing anomaly rejection, and N-probe consensus.
3. **In-Browser Client Probe**: Voluntary browser-side probe running on visitors inside Türkiye using non-credentialed `no-cors` timing measurements.
4. **Edge Persistence & Edge Caching (D1 + KV)**:
   - Cloudflare D1 for domains, probe registrations, raw measurements, and 24h/7d downsampled time-series.
   - Cloudflare KV for high-frequency cached domain verdicts with stale-while-revalidate headers.

---

## 3. Monorepo Structure
```
isitdownforturkey/
├── apps/
│   ├── api/                      # Cloudflare Worker (Hono + D1 + KV + Cron)
│   │   ├── src/
│   │   │   ├── index.ts          # API router entrypoint
│   │   │   ├── routes/
│   │   │   │   ├── check.ts      # GET /api/check?domain=
│   │   │   │   ├── ingest.ts     # POST /api/probes/report
│   │   │   │   ├── register.ts   # POST /api/probes/register
│   │   │   │   ├── browser.ts    # POST /api/browser/report
│   │   │   │   ├── badge.ts      # GET /api/badge/:domain.svg
│   │   │   │   └── watchlist.ts  # GET /api/watchlist
│   │   │   ├── services/
│   │   │   │   ├── baseline.ts   # Global DoH and HTTP probe
│   │   │   │   ├── aggregation.ts# Layer fusion & verdict calculator
│   │   │   │   └── anti-spoof.ts # Signature, reputation & consensus
│   │   │   └── db/
│   │   │       ├── schema.sql    # D1 SQLite schema
│   │   │       └── queries.ts    # Type-safe prepared statements
│   │   ├── wrangler.toml         # Cloudflare Worker config
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                      # Astro Static / Edge SSR (TR default, EN)
│       ├── public/
│       │   ├── favicon.svg
│       │   └── robots.txt
│       ├── src/
│       │   ├── layouts/Layout.astro
│       │   ├── components/
│       │   │   ├── Header.astro
│       │   │   ├── SearchBox.astro
│       │   │   ├── VerdictCard.astro
│       │   │   ├── IspGrid.astro
│       │   │   ├── HistoryChart.astro
│       │   │   ├── BrowserProbe.astro
│       │   │   └── Footer.astro
│       │   ├── pages/
│       │   │   ├── index.astro
│       │   │   ├── en/index.astro
│       │   │   ├── d/[domain].astro
│       │   │   ├── en/d/[domain].astro
│       │   │   ├── watchlist.astro
│       │   │   ├── en/watchlist.astro
│       │   │   ├── methodology.astro
│       │   │   ├── en/methodology.astro
│       │   │   └── sitemap.xml.ts
│       │   └── i18n/
│       │       ├── tr.json
│       │       └── en.json
│       ├── astro.config.mjs
│       ├── tailwind.config.cjs
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── shared/                   # Shared types, Zod schemas, logic
│   │   ├── src/
│   │   │   ├── types.ts          # Core domain models & verdicts
│   │   │   ├── ssrf.ts           # IP/Hostname security & normalization
│   │   │   ├── aggregation.ts    # ISP & consensus engine
│   │   │   ├── fingerprints.ts   # BTK/ISP block detection patterns
│   │   │   ├── isps.ts           # ASN to ISP mapping & metadata
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── probe/                    # Volunteer Probe Agent
│   │   ├── node/
│   │   │   ├── src/agent.js      # Zero-dependency Node.js probe
│   │   │   └── package.json
│   │   ├── python/
│   │   │   ├── probe.py          # Standalone Python 3 probe
│   │   │   └── requirements.txt
│   │   ├── Dockerfile            # Lightweight Docker distribution
│   │   ├── docker-compose.yml
│   │   └── README.md             # Volunteer onboarding guide
│   │
│   └── cli/                      # npx isitdownforturkey CLI
│       ├── bin/cli.js
│       ├── package.json
│       └── README.md
│
├── docs/                         # Living documentation
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── PROGRESS.md
│   ├── PLAN.md
│   ├── API.md
│   └── PROBE_SPEC.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml                # Lint, typecheck, test
│       └── deploy.yml            # Cloudflare deploy
│
├── package.json                  # Root npm workspaces
├── tsconfig.base.json
├── .gitignore
├── LICENSE                       # MIT
└── README.md
```

---

## 4. Detailed Milestone Roadmap

### Milestone 0: Repo Bootstrap & Living Docs (Current)
- Initialize Git repository and standard `.gitignore`.
- Set up root `package.json` with npm workspaces (`apps/*`, `packages/*`).
- Scaffold TypeScript base configs and directory structure.
- Write living documentation: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/PLAN.md`.
- Set up GitHub Actions CI workflow skeleton (`.github/workflows/ci.yml`).
- Verification: Root install runs cleanly, workspace resolution succeeds.

### Milestone 1: Shared Core Logic & Verdict Aggregation (Test-First)
- Implement `packages/shared/src/types.ts`: Domain models, ISP enums, probe payloads, verdict types (`UP`, `BLOCKED`, `DOWN_GLOBALLY`, `DEGRADED`, `UNKNOWN`).
- Implement `packages/shared/src/ssrf.ts`: Strict SSRF validation:
  - Reject IPv4 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16).
  - Reject loopback (127.0.0.0/8, ::1), link-local (169.254.0.0/16, fe80::/10), cloud metadata (169.254.169.254, metadata.google.internal).
  - Normalize domains (punycode, lowercase, strip protocols and ports, strip trailing dots).
- Implement `packages/shared/src/fingerprints.ts`: BTK Law 5651 block signatures, ISP redirection IP patterns (195.175.x.x), title patterns.
- Implement `packages/shared/src/aggregation.ts`: Multi-layer consensus engine:
  - Minimum agreeing probes threshold per ISP ($K \ge 2$ agreeing probes, or single probe with explicit blockpage fingerprint).
  - Outlier rejection and confidence scoring (`high`, `medium`, `low`, `none`).
- Unit tests with Vitest covering edge cases, malicious domain attacks, and aggregation permutations.

### Milestone 2: Cloudflare Workers API + D1 Storage + Global Baseline
- Configure `apps/api` with Hono web framework and Cloudflare Workers runtime.
- Design SQLite schema for D1:
  - `domains`: normalized domain, watchlist flag, category, created_at.
  - `measurements`: timestamp, domain_id, source (`global`, `probe`, `browser`), asn, isp, status, block_reason, latency_ms.
  - `probe_nodes`: probe_id, hmac_key_hash, asn, isp, reputation_score, last_seen.
  - `hourly_rollups`: domain_id, isp, hour_bucket, up_count, blocked_count, down_count, avg_latency.
- Implement Global Baseline Service:
  - Cloudflare DoH (`https://cloudflare-dns.com/dns-query`) and Google DoH (`https://dns.google/resolve`).
  - Edge fetch with strict timeout (5000ms), abort controller, and TLS validation.
- Implement `GET /api/check?domain=`: Runs SSRF check, looks up KV/D1 cache, triggers background baseline check if stale, returns unified verdict.

### Milestone 3: Fast Bilingual Frontend MVP (Astro / Tailwind)
- Configure `apps/web` with Astro static site generator + Cloudflare Pages adapter.
- Internationalization: Turkish (`/`) as primary default, English (`/en/`).
- Mobile-first, responsive UI with dark/light mode toggle.
- Key views:
  - Homepage (`/`): Prominent search bar, quick watchlist status tiles, real-time query interface.
  - Domain detail (`/d/[domain]`): Big status badge, confidence indicator, per-ISP reachability matrix, blocking diagnosis breakdown.
  - Watchlist (`/watchlist`): Curated popular dev tools, gaming services, social media.
  - Methodology (`/methodology`): Transparent explanation of tests, privacy architecture, and volunteer probe model.
- SVG Badge generator endpoint: `/api/badge/:domain.svg` (embeddable in GitHub READMEs).

### Milestone 4: Volunteer Türkiye Probe Network & Signed Ingest
- Implement `packages/probe/node/src/agent.js` (zero-dependency Node.js CLI):
  - Resolves target via system DNS (`dns.resolve4`).
  - Resolves target via DoH (Cloudflare/Google).
  - Measures TCP connect latency and TLS handshake with SNI.
  - Performs HTTP HEAD/GET request to detect 5651 block pages.
- Implement Python equivalent `packages/probe/python/probe.py` for headless servers.
- Provide Dockerfile and simple `docker run` command.
- Implement Worker ingest endpoint `POST /api/probes/report`:
  - Request HMAC-SHA256 signature verification using probe secret token.
  - Server-side ASN derivation via `request.cf.asn` (client cannot spoof ASN; incoming IP is never stored).
  - Probe registration endpoint `POST /api/probes/register` providing one-time registration token.

### Milestone 5: In-Browser Live Check
- Implement `src/components/BrowserProbe.astro` client component:
  - Detects if visitor is in Türkiye via edge geo header.
  - Executes non-credentialed `fetch(url, { mode: 'no-cors' })` with strict abort timeout.
  - Reports reachability timing anonymously to `POST /api/browser/report`.
  - Documents browser limits (CORS masking, opaque responses) in DECISIONS.md.

### Milestone 6: Watchlist Automation, History & Downsampling
- Cloudflare Cron Trigger (every 10 minutes) checking top watchlist domains.
- Compact time-series aggregation to stay strictly within D1 free-tier (5M rows/month limit).
- Interactive 24-hour and 7-day status history graphs using zero-dependency SVG sparklines.

### Milestone 7: Hardening, Performance, A11y & SEO
- Security audit: SSRF test suite, rate limiting (Cloudflare rate-limiting / KV leaky-bucket), CSP headers.
- Lighthouse performance optimization (target 95+ performance, accessibility, SEO, best practices).
- OpenGraph meta tags, Twitter cards, dynamic social share previews for `/d/<domain>`.
- Full Turkish and English linguistic audit.

### Milestone 8: Production Deployment & Volunteer Guide
- Deploy API Worker to Cloudflare (`*.workers.dev`).
- Deploy Frontend to Cloudflare Pages (`*.pages.dev`).
- Verify production deployment with synthetic end-to-end checks.
- Publish probe volunteer guide (`docs/PROBES.md`) in TR and EN.

### Milestone 9: Post-MVP Ecosystem
- CLI tool `packages/cli` executable via `npx isitdownforturkey <domain>`.
- RSS/Atom feed for ongoing block incidents (`/api/feed.xml`).
- Daily open data snapshot export (`/api/export/daily.json`).

---

## 5. Verification & Testing Strategy
- **Unit & Logic Tests**: `packages/shared` tested with 100% coverage on SSRF, domain normalization, block-page fingerprinting, and consensus algorithm.
- **API Tests**: Mocked Worker environment testing endpoints, rate-limits, and ingest signatures.
- **E2E Tests**: Playwright testing homepage search, domain detail page, language switching, and responsive views.
