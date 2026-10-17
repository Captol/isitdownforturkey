# Decisions Log: isitdownforturkey

## 2026-10-16 — Milestone 3: Frontend Typecheck Fix
**Decision**: Remove `.astro` files from `apps/web/tsconfig.json` `include` array.  
**Reason**: `tsc` (via `astro check`) cannot resolve `.astro` imports — this is a known Astro+tsc integration limitation. The Astro compiler handles `.astro` type checking at build time. Build (`astro build`) succeeds; only `tsc` standalone fails. Minimal fix: let Astro handle `.astro`, use `tsc` only for `.ts` files.
**Alternative considered**: Adding `allowJs` + custom path mappings — more complex, no real benefit.

## 2026-10-16 — Milestone 3: i18n Import Path
**Decision**: Use bare module import `from '../i18n/strings'` (no `.js` extension) in `.astro` files.  
**Reason**: Astro's module resolver handles extensionless imports. Adding `.js` extension caused TypeScript errors because tsc doesn't map `.js`→`.ts` without `allowJs` + `esModuleInterop` (which we have but the path resolution still fails). Env.d.ts `declare module` declarations handle the rest.

## 2026-10-16 — Milestone 4: Probe Agent Language Choice
**Decision**: Ship both Node.js and Python variants of the probe agent, both with zero external dependencies.  
**Reason**: Volunteers may have either runtime available. Python is more universally available on shared/VPS hosting. Node.js variant uses built-in modules only. Dockerfile based on Python image for simplicity.
**Trade-off**: Slightly more maintenance surface, but wider volunteer accessibility.

## 2026-10-16 — Milestone 4: HMAC vs Other Auth
**Decision**: Use HMAC-SHA256 for probe report signing.  
**Reason**: Stateless, no database lookup needed for verification, fast, standard for API auth. Simpler than JWT for this use case (single shared secret per probe, not per-user).
**Alternative considered**: API key in header — simpler but less secure (key transmitted in cleartext on each request, no payload integrity).

## 2026-10-16 — Milestone 4: Rate Limiting Approach
**Decision**: In-memory `RateLimiter` with periodic prune(), no external dependency.  
**Reason**: Workers have ephemeral memory per invocation, but same-worker requests share state. For a low-traffic probe ingest endpoint, in-memory is sufficient. KV-backed would be more robust but adds complexity.
**Ceiling**: If probe volume grows, migrate to D1/KV-backed limiter. See `# ponytail: in-memory rate limiter, move to KV if probe count > 1000/day`.

## 2026-10-17 — Sitemap via API Route
**Decision**: Use Astro dynamic `sitemap.xml.ts` API route instead of static XML file.  
**Reason**: The set of tracked domains comes from the API watchlist; a static sitemap would go stale. An API route generates it at build time and can be cached with `max-age=3600`. Ponytail ceiling: if domain count grows large, switch to on-demand generation via Cloudflare Worker.

## 2026-10-17 — robots.txt Placement
**Decision**: Put `robots.txt` in `apps/web/public/robots.txt` as a static asset.  
**Reason**: Simplest possible approach for a static Astro build. No need for a dynamic route — the sitemap URL is the only directive and never changes.

## 2026-10-17 — Volunteer Probe Guide Location
**Decision**: Place bilingual TR/EN probe guide at `docs/PROBES.md` (not inside `packages/probe/README.md`).  
**Reason**: `packages/probe/README.md` is implementation-focused; the volunteer guide is operational/onboarding content that belongs in the project docs alongside ARCHITECTURE.md and PLAN.md. README.md updated to cross-link both.

## 2026-10-17 — CLI Zero-Dependency Design
**Decision**: `packages/cli/bin/cli.js` uses only built-in `node:fetch` — no npm deps.  
**Reason**: CLI is distributed via `npx`; adding dependencies bloats the install path and slows first use. The API is simple enough that a single fetch call suffices. ponytail: could add color output or richer formatting later.

## 2026-10-17 — RSS Feed & Open Data Export
**Decision**: Add `/api/feed.xml` (RSS of recent blocks) and `/api/export/daily.json` (last 24h snapshot, ≤500 rows).  
**Reason**: Supports community monitoring (RSS readers) and open-data reuse (JSON). Both are read-only, no auth, rate-limited by D1 free-tier row limits. ponytail: if row volume grows, add pagination and date-range params.
