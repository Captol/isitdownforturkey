# isitdownforturkey Probe Agent

Volunteer probe agent that runs from inside Turkish ISPs and reports
reachability measurements to the isitdownforturkey API.

## Quick Start

```bash
# Register a probe token (once, from the API)
# POST /api/probes/register
# { "asn": 9121 }
# → { "probeId": "...", "token": "..." }

# Set environment
export PROBE_TOKEN=<your-token>
export PROBE_API_URL=https://isitdownforturkey.pages.dev

# Run once
node index.js --once

# Run continuously (every 60s by default)
node index.js

# Custom domains and interval
node index.js --once --domains google.com youtube.com --interval 120
```

## Python Variant

```bash
python probe.py --once
python probe.py  # continuous
```

## Docker

```bash
docker build -t isitdownforturkey/probe .
docker run \
  -e PROBE_TOKEN=<your-token> \
  -e PROBE_API_URL=https://isitdownforturkey.pages.dev \
  isitdownforturkey/probe
```

## How It Works

1. **ASN Detection**: Looks up public ASN via ip-api.com
2. **DNS Resolution**: Queries system DNS + Cloudflare DoH + Google DoH in parallel
3. **TCP Test**: Raw socket connect to port 443
4. **TLS Test**: TLS handshake (detects SNI resets)
5. **HTTP Test**: Full GET with title extraction
6. **Block Detection**: Matches BTK court order patterns in HTML
7. **Signing**: HMAC-SHA256 signs the report payload
8. **Submission**: POSTs signed report to `/api/probes/report`

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PROBE_TOKEN` | — | HMAC signing token from `/api/probes/register` |
| `PROBE_API_URL` | `http://localhost:8787` | API base URL |
| `PROBE_INTERVAL` | `60` | Seconds between probe cycles |

## CLI Flags

| Flag | Description |
|---|---|
| `--once` | Run one cycle and exit |
| `--token <str>` | Override PROBE_TOKEN |
| `--api-url <url>` | Override PROBE_API_URL |
| `--interval <n>` | Override PROBE_INTERVAL |
| `--domains <...>` | Custom domain list |

## Security

- Reports are HMAC-SHA256 signed — the API verifies each one
- ASN in the report is cross-checked against the request's Cloudflare ASN
- Rate limited: 30 reports/min per probe, 5 registrations/min per IP
- No PII stored; client IPs are discarded after ASN derivation
