# System Architecture: Is It Down For Türkiye?

## 1. System Overview
**isitdownforturkey** operates as a distributed reachability diagnosis platform designed specifically to measure, verify, and explain website availability inside Türkiye while maintaining a strict $0 operational footprint.

Because edge servers located outside Türkiye cannot experience ISP-level filtering or domestic censorship, the architecture decouples measurement into three distinct confidence layers:
```
                      +------------------------------------------+
                      |               Public User                |
                      +------------------------------------------+
                                    |               ^
                      Query / Search|               | Verdict & ISP Grid
                                    v               |
                      +------------------------------------------+
                      |         apps/web (Astro / Pages)         |
                      |   - Static-first, Edge SSR for /d/*      |
                      |   - Bilingual TR / EN, Dark Mode         |
                      |   - In-Browser Reachability Probe        |
                      +------------------------------------------+
                                    |
                                    | API Calls (Edge-cached)
                                    v
                      +------------------------------------------+
                      |         apps/api (Cloudflare Worker)     |
                      |   - SSRF Guard & Domain Normalizer       |
                      |   - Global Baseline Checker (DoH+HTTP)   |
                      |   - Signed Probe Ingest (HMAC-SHA256)    |
                      |   - Layer Aggregation & Verdict Engine   |
                      +------------------------------------------+
                               /            |           \
                              /             |            \
             +---------------+    +-------------------+   +---------------+
             | Cloudflare D1 |    |   Cloudflare KV   |   | Cloudflare    |
             | (Relational   |    | (High-speed L1    |   | Cron Triggers |
             |  Time-series) |    |  Verdict Cache)   |   | (Watchlist)   |
             +---------------+    +-------------------+   +---------------+
                     ^                      ^
                     |                      |
            +----------------+     +----------------+
            | Layer 2 Probes |     | Layer 3 Client |
            | Volunteers in  |     | In-Browser     |
            | TT, Superonline|     | Visitors in    |
            | TurkNet, etc.  |     | Türkiye        |
            +----------------+     +----------------+
```

---

## 2. The 3 Measurement Layers

### Layer 1: Global Baseline (Automated, Zero-Cost)
- **Origin**: Cloudflare Workers running outside Türkiye.
- **Function**: Validates whether the target service is operational globally.
- **Components**:
  1. **DoH Upstream Resolution**: Resolves records using Cloudflare (`1.1.1.1`) and Google (`8.8.8.8`) DNS-over-HTTPS.
  2. **Direct HTTPS Probe**: Issues lightweight TLS connection with strict 5s timeout and standard user-agent.
- **Verdict Impact**: If the global baseline fails across multiple international resolvers and edge probes, the status is immediately flagged as `DOWN_GLOBALLY` regardless of domestic probes.

### Layer 2: Türkiye Volunteer Probes (High Confidence Ground Truth)
- **Origin**: Volunteer nodes running inside Turkish ISPs (Türk Telekom, Turkcell Superonline, TurkNet, Vodafone TR, Türksat Kablonet).
- **Client**: Single-file Node.js or Python agent, distributed also via Docker.
- **Measurement Protocol**:
  1. **Dual DNS Resolution**: Compares local ISP DNS resolution against global DoH (detects DNS poisoning and sinkhole IPs such as `195.175.x.x`).
  2. **TCP & TLS/SNI Handshake**: Attempts TLS handshake with SNI. If TCP connects but TLS resets or drops, identifies SNI-based filtering.
  3. **HTTP Response & Fingerprint**: Inspects status codes and HTML bodies for known 5651 BTK block notice signatures.
- **Anti-Spoofing & Ingest Security**:
  - Each probe is provisioned with a cryptographic token. Reports are signed with HMAC-SHA256.
  - Server derives client ASN directly from `request.cf.asn` (preventing ISP impersonation).
  - Client IP is **never recorded** in the database; it is discarded immediately after ASN verification.
  - Anomaly filter: Consensus requires $K \ge 2$ independent agreeing probes per ISP before flagging `BLOCKED`, or an unambiguous cryptographic/signature match of an official court decision page.

### Layer 3: Live In-Browser Client Probes (Real-time Crowd Validation)
- **Origin**: Visitors browsing the site from within Türkiye.
- **Client**: Background script on `/d/[domain]`.
- **Measurement Protocol**:
  - Tests reachability using non-credentialed `fetch(target, { mode: 'no-cors' })`.
  - Distinguishes network abort / DNS / TCP connection failures from successful resource loading (opaque response).
  - Submits anonymized reachability reports to `/api/browser/report` with zero cookies or tracking identifiers.

---

## 3. Verdict Aggregation Logic
The final verdict per domain per ISP is computed deterministically using the following state machine:

```
                  +---------------------------+
                  |  Global Baseline Check    |
                  +---------------------------+
                                |
                  Target down globally?
                     /         \
                 YES/           \NO
                   v             v
          [DOWN_GLOBALLY]    +---------------------------+
                             |  Examine Türkiye Probes   |
                             +---------------------------+
                                           |
                       Any ISP probe reports with consensus?
                                  /                 \
                              YES/                   \NO
                                v                     v
                        Check Evidence         Check Browser Probes
                     /        |        \                |
       Block Page/  /   SNI/ /          \ Normal      Browser
         DNS Poison/   Reset/            \ Reachable   Failures?
                  v        v              v           /         \
              [BLOCKED] [BLOCKED]       [UP]       YES           NO
              (Method)  (Method)                    v             v
                                                [DEGRADED]    [UNKNOWN]
```

Verdicts:
- `UP`: Reachable normally both globally and domestically.
- `BLOCKED`: Service is reachable globally, but actively prevented by ISP/BTK inside Türkiye (annotated with reason: `dns_poisoning`, `sni_reset`, `ip_block`, `http_block_page`).
- `DOWN_GLOBALLY`: Service is unreachable from standard global infrastructure.
- `DEGRADED`: Partial intermittent reachability, packet loss, or high failure rates.
- `UNKNOWN`: Insufficient probe volume inside Türkiye to provide high confidence.

---

## 4. Privacy & Threat Model

### Privacy Guarantees
- **No IP Addresses Stored**: Incoming client IPs for both API queries and probe reports are processed ephemerally in RAM by Cloudflare Workers, used solely for ASN lookup, and never written to disk or logs.
- **No Cookies / Local Storage Tracking**: No analytics cookies, no fingerprinting scripts.
- **Zero Third-Party Trackers**: Self-hosted fonts and assets; no Google Analytics or external tracking beacons.

### Security Defenses
- **SSRF Defense**: The API validates and sanitizes all incoming target domain inputs before executing any baseline probe:
  - Rejection of private IPv4 (RFC 1918), IPv6 unique local, loopback (`127.0.0.1`), link-local (`169.254.169.254`), broadcast, and cloud internal metadata endpoints (`metadata.google.internal`).
  - Punycode normalization and validation of public FQDNs.
  - Enforcement of HTTP/HTTPS schemes only, rejection of internal ports.
- **Ingest Rate-Limiting**: Token bucket per probe ID to prevent DoS on ingest endpoints.
