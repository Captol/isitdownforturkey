# Only work inside this folder (Desktop\Deney). Never read, edit, or run commands against any path outside it.

# isitdownforturkey: Project Rules for Claude Code

## What this project is
A free, public website that shows whether a site or service is reachable FROM TÜRKİYE, and if not, why (ISP/BTK block, DNS poisoning, SNI/TLS block, IP block, or genuinely down globally). Bilingual (TR default, EN). Developer-first.

## Operating mode (always follow)
- Work autonomously and end-to-end. Do not ask me questions you can decide yourself. Pick the sensible option, log it in `/docs/DECISIONS.md` (one line + reason), and continue.
- Ask me ONLY when: (a) a secret, API key or account login is needed that only I can provide, (b) an action costs money or is irreversible/destructive (deleting data, force-push, buying a domain), or (c) two options lead to materially different product outcomes.
- When asking, batch everything into ONE message, with a recommended default for each question.
- After every milestone: run tests, typecheck, lint, `/verify`, run code-reviewer and security-reviewer, fix findings, commit (conventional commits), update `/docs/PROGRESS.md`, then continue to the next milestone without waiting for approval.
- If a session is interrupted or context is long, checkpoint to `/docs/PROGRESS.md`. On "continue", resume from that file.
- Use the everything-claude-code agents and commands (planner, architect, tdd-guide, code-reviewer, security-reviewer, build-error-resolver, e2e-runner; `/plan`, `/tdd`, `/code-review`, `/verify`, `/build-fix`, `/checkpoint`) instead of ad-hoc workflows.
- Never invent data. No measurement means "no data" / UNKNOWN, never a guess.

## Hard constraints
- $0 operating cost. Only non-expiring free tiers (Cloudflare Pages/Workers/D1/KV/Cron, GitHub Actions/Pages, optionally Supabase/Neon free). No credit card, no paid services.
- Static-first, fast, light. Lighthouse 95+ target.
- No accounts, no tracking cookies, never store visitor IPs. Derive ISP/ASN server-side, then discard the IP.
- SSRF protection on every check endpoint: validate and normalize domains, reject private/internal ranges, localhost, link-local and cloud metadata addresses, non-public hostnames and non-HTTP(S) schemes. Rate limit and abuse-protect all public endpoints.
- Passive reachability checks of public hosts only. No content scraping, no circumvention tooling.

## Measurement architecture (do not blur these layers)
1. **Global baseline**: Cloudflare Worker + Cron, checks from outside Türkiye. This is NOT a Türkiye measurement and must never be labeled as one.
2. **Türkiye probes**: open-source agent run by volunteers inside Turkish ISPs (system DNS vs DoH, TCP, TLS with SNI, HTTP, block-page fingerprint, latency). Signed, rate-limited ingest with per-probe tokens, outlier rejection, and a minimum number of agreeing probes per ISP before showing BLOCKED.
3. **Live browser check**: visitor's own browser tests reachability and reports anonymized ISP/ASN only. Document CORS/opaque-response limits.
- Verdicts: UP, BLOCKED (with likely method), DOWN GLOBALLY, DEGRADED, UNKNOWN (insufficient Türkiye data). Always show a confidence badge and per-ISP breakdown (Türk Telekom, Turkcell Superonline, TurkNet, Vodafone TR, Türksat/Kablonet, others).

## Stack (override only with a logged reason)
- Monorepo: `apps/web`, `apps/api`, `packages/probe`, `packages/shared`, `docs`.
- Web: Astro or SvelteKit/Vite static on Cloudflare Pages, minimal JS, i18n TR/EN, mobile-first, dark mode, accessible, SEO (indexable `/d/<domain>` pages, sitemap, OG images).
- API: Cloudflare Workers (TypeScript), Hono, Zod, D1, KV, Cron Triggers.
- Probe: Node.js (minimal/zero deps) and a Python variant, plus a Docker one-liner.
- Tests: Vitest (unit), Playwright (E2E), Miniflare/wrangler dev locally. Aim for 80%+ coverage on core logic (verdict aggregation, SSRF guard, block-page fingerprinting).
- CI/CD: GitHub Actions (lint, typecheck, test, deploy on main), Dependabot, secret scanning.

## Code standards
- TypeScript strict mode. No `any` without a comment explaining why.
- Small files and functions, immutable data, validate all external input with Zod at boundaries.
- No secrets in the repo. Use `.env.example` and Cloudflare/GitHub secrets.
- Tests first for core logic (`/tdd`). Bug fix = failing test first.
- Keep D1 usage inside free-tier limits: compact time-series, downsample old data.

## Milestones (execute in order)
0. Repo bootstrap, docs, CI skeleton
1. Shared types + verdict aggregation (test-first)
2. SSRF-safe check API + global baseline + D1 schema
3. Frontend MVP (home, `/d/<domain>`, TR/EN, dark mode)
4. Probe agent + signed ingest + anti-spoofing + block-page fingerprints
5. Live browser check
6. Watchlist, cron, history charts, status badge
7. Security, performance, accessibility and SEO passes
8. Deploy to free `*.pages.dev` / `*.workers.dev`, E2E on production, launch docs and volunteer guide (TR + EN)
9. Backlog: Telegram/Discord bot, RSS, open data export, CLI (`npx isitdownforturkey`), community reports

## Definition of done (per milestone)
Tests green, typecheck + lint clean, `/verify` passes, no HIGH/CRITICAL findings from security-reviewer, docs updated, committed. Then proceed immediately.

## Manual steps that need me (batch these early)
- `wrangler login` (Cloudflare) and creating the GitHub repo/remote
- Any domain purchase (ask first; default to free `*.pages.dev`)
