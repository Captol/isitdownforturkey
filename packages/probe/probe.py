#!/usr/bin/env python3
"""
Volunteer Probe Agent — Python variant (zero external dependencies)

Runs from inside Turkish ISPs and reports reachability measurements
to the isitdownforturkey API. Reports are HMAC-signed for authenticity.

Usage:
    python probe.py                     # continuous mode (every 60s)
    python probe.py --once              # single run, then exit
    python probe.py --domains example.com discord.com
    python probe.py --token <your-token> --api-url https://api.example.com

Environment variables:
    PROBE_TOKEN    — HMAC signing token (from /api/probes/register)
    PROBE_API_URL  — API base URL (default: http://localhost:8787)
    PROBE_INTERVAL — polling interval in seconds (default: 60)
"""

import argparse
import asyncio
import hashlib
import hmac
import json
import os
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# ─── Constants ───────────────────────────────────────────────────────────────

DEFAULT_API_URL = os.environ.get("PROBE_API_URL", "http://localhost:8787")
DEFAULT_INTERVAL = int(os.environ.get("PROBE_INTERVAL", "60"))
TOKEN_FILE = Path(".probe_token")
STATE_FILE = Path(".probe_state.json")

DEFAULT_DOMAINS = [
    "discord.com", "github.com", "steamcommunity.com",
    "openai.com", "anthropic.com", "npmjs.com",
    "hub.docker.com", "huggingface.co", "twitter.com",
    "facebook.com", "instagram.com", "youtube.com",
    "whatsapp.com", "telegram.org", "pinterest.com",
    "reddit.com", "tiktok.com", "linkedin.com",
    "spotify.com", "netflix.com",
]

# ─── Config ──────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="isitdownforturkey Probe Agent")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--token", default=os.environ.get("PROBE_TOKEN", ""), help="HMAC signing token")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="API base URL")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL, help="Polling interval (seconds)")
    parser.add_argument("--domains", nargs="*", default=[], help="Domains to probe")
    parser.add_argument("--asn", type=int, default=0, help="Override ASN (from register response)")
    return parser.parse_args()

# ─── Token & State ───────────────────────────────────────────────────────────

def load_token() -> str:
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text().strip()
    return os.environ.get("PROBE_TOKEN", "")

def save_token(token: str) -> None:
    TOKEN_FILE.write_text(token)

def load_state() -> dict[str, Any]:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {"probe_id": __import__("uuid").uuid4().hex, "last_run": "", "last_domain": "", "consecutive_failures": 0}

def save_state(state: dict[str, Any]) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2))

# ─── ASN Detection ───────────────────────────────────────────────────────────

async def detect_asn() -> int:
    """Detect public ASN via free geo-IP APIs (no key required)."""
    # Fallback chain: each service works from different networks
    endpoints = [
        ("http://ip-api.com/json/?fields=as", "as"),
        ("https://ipinfo.io/json?token=", "asn"),  # ipinfo.io free tier without token returns limited fields
        ("https://ipapi.co/json/", "asn"),
    ]
    for url, field in endpoints:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"})
            resp = await asyncio.to_thread(urllib.request.urlopen, req, timeout=8)
            try:
                data = json.loads(await asyncio.to_thread(resp.read))
            finally:
                resp.close()
            if field in data and data[field]:
                val = str(data[field])
                # ip-api.com returns "AS12345 XYZ"; ipinfo/ipapi return "AS12345" or 12345
                import re
                m = re.search(r"(\d+)", val)
                if m:
                    return int(m.group(1))
        except Exception:
            continue
    return 0

# ─── DNS Resolution ──────────────────────────────────────────────────────────

async def resolve_system_dns(domain: str) -> list[str]:
    """Resolve domain using system DNS."""
    try:
        async with asyncio.timeout(5):
            answers = await asyncio.to_thread(socket.getaddrinfo, domain, 443, socket.AF_INET)
            return list({r[4][0] for r in answers})
    except Exception:
        return []

async def resolve_doh(domain: str, url: str) -> list[str]:
    """Resolve domain via DoH endpoint."""
    try:
        encoded = urllib.parse.quote(domain, safe="")
        doh_url = f"{url}?name={encoded}&type=A"
        req = urllib.request.Request(doh_url, headers={"Accept": "application/dns-json"})
        resp = await asyncio.to_thread(urllib.request.urlopen, req)
        try:
            data = json.loads(await asyncio.to_thread(resp.read))
            return [a["data"] for a in data.get("Answer", [])]
        finally:
            resp.close()
    except Exception:
        return []

# ─── TCP/TLS/HTTP Probing ────────────────────────────────────────────────────

async def test_tcp_connect(domain: str) -> tuple[bool, int]:
    """Test TCP connectivity to domain:443."""
    start = time.monotonic()
    loop = asyncio.get_event_loop()
    try:
        async with asyncio.timeout(5):
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(domain, 443), timeout=5
            )
            writer.close()
            await writer.wait_closed()
            return True, int((time.monotonic() - start) * 1000)
    except (asyncio.TimeoutError, OSError, ConnectionError):
        return False, int((time.monotonic() - start) * 1000)

async def test_tls(domain: str) -> tuple[bool, Optional[str], int]:
    """Test TLS handshake. Returns (ok, classification, latency_ms)."""
    start = time.monotonic()
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        async with asyncio.timeout(5):
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(domain, 443, ssl=ctx), timeout=5
            )
            writer.close()
            await writer.wait_closed()
            return True, None, int((time.monotonic() - start) * 1000)
    except ssl.SSLError as e:
        code = getattr(e, 'code', None)
        reason = f"ssl:{code}" if code is not None else "ssl_error"
        return False, reason, int((time.monotonic() - start) * 1000)
    except asyncio.TimeoutError:
        return False, "timeout", int((time.monotonic() - start) * 1000)
    except ConnectionResetError:
        return False, "reset", int((time.monotonic() - start) * 1000)
    except OSError as e:
        return False, f"os_error:{type(e).__name__}", int((time.monotonic() - start) * 1000)
    except ConnectionError as e:
        return False, f"connection_error:{e}", int((time.monotonic() - start) * 1000)

async def test_http(domain: str) -> dict[str, Any]:
    """Make HTTP GET and collect response info."""
    start = time.monotonic()
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        url = f"https://{domain}/"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        })
        resp = await asyncio.to_thread(urllib.request.urlopen, req, context=ctx)
        try:
            body_bytes = await asyncio.to_thread(resp.read)
            body = body_bytes.decode("utf-8", errors="replace")
            title_match = __import__("re").search(r"<title[^>]*>([^<]+)</title>", body, re.IGNORECASE)
            return {
                "status": resp.status,
                "title": title_match.group(1).strip() if title_match else None,
                "body_snippet": body[:500],
                "latency_ms": int((time.monotonic() - start) * 1000),
            }
        finally:
            resp.close()
    except urllib.error.HTTPError as e:
        return {"status": e.code, "latency_ms": int((time.monotonic() - start) * 1000)}
    except Exception as e:
        return {"error": str(e), "latency_ms": int((time.monotonic() - start) * 1000)}

# ─── Block Detection ─────────────────────────────────────────────────────────

def detect_block_page(title: Optional[str] = None, body: Optional[str] = None) -> Optional[str]:
    """Detect BTK/ISP block page signatures."""
    import re
    text = ((title or "") + " " + (body or "")).lower()
    patterns = [
        r"5651\s*sayılı\s*kanaat",
        r"5651\s*sayılı\s*kanun",
        r"adli\s*müdahale",
        r"erişim\s*engellenmiştir",
        r"site\s*engellenmiştir",
        r"internet\s*engelleme",
        r"mahkeme\s*kararı",
    ]
    for pat in patterns:
        if re.search(pat, text, re.IGNORECASE):
            return "http_block_page"
    return None

# ─── Report Signing ──────────────────────────────────────────────────────────

def sign_report(token: str, report: dict[str, Any]) -> str:
    """HMAC-SHA256 sign a report payload."""
    payload = json.dumps(report, sort_keys=True)
    return hmac.new(token.encode(), payload.encode(), hashlib.sha256).hexdigest()

# ─── Main Probe Logic ────────────────────────────────────────────────────────

def detect_isp(asn: int) -> str:
    """Classify ASN into a Turkish ISP name. Returns 'other' if unknown."""
    # Known Turkish ISP ASNs (sources: RIPE NCC, ARIN, public BGP)
    ISP_ASNS: dict[str, list[int]] = {
        'turk-telekom': [9121],
        'turkcell-superonline': [34984, 44244],
        'turknet': [12735],
        'vodafone-tr': [15897, 61311],
        'tursat-kablonet': [47524, 55671],
    }
    for isp, asns in ISP_ASNS.items():
        if asn in asns:
            return isp
    return 'other'


async def probe_domain(domain: str, token: str, probe_id: str, asn: int) -> Optional[dict[str, Any]]:
    """Run full probe for a domain."""
    isp = detect_isp(asn)
    # DNS resolution
    system_dns, doh_cf, doh_google = await asyncio.gather(
        resolve_system_dns(domain),
        resolve_doh(domain, "https://1.1.1.1/dns-query"),
        resolve_doh(domain, "https://dns.google/resolve"),
    )

    # TCP
    tcp_connected, tcp_latency = await test_tcp_connect(domain)
    if not tcp_connected:
        return {
            "domain": domain, "probe_id": probe_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "asn": asn, "isp": isp,
            "system_dns": system_dns or None,
            "doh_cloudflare": doh_cf or None,
            "doh_google": doh_google or None,
            "tcp_connected": False, "tls_succeeded": False,
            "tcp_latency_ms": tcp_latency,
        }

    # TLS
    tls_ok, tls_error, tls_latency = await test_tls(domain)
    if not tls_ok:
        return {
            "domain": domain, "probe_id": probe_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "asn": asn, "isp": isp,
            "system_dns": system_dns or None,
            "doh_cloudflare": doh_cf or None,
            "doh_google": doh_google or None,
            "tcp_connected": True, "tls_succeeded": False,
            "tcp_latency_ms": tcp_latency,
            "tls_latency_ms": tls_latency,
            "block_reason": "sni_reset",
        }

    # HTTP
    http_result = await test_http(domain)
    block_reason = detect_block_page(http_result.get("title"), http_result.get("body_snippet", ""))

    return {
        "domain": domain, "probe_id": probe_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "asn": asn, "isp": isp,
        "system_dns": system_dns or None,
        "doh_cloudflare": doh_cf or None,
        "doh_google": doh_google or None,
        "tcp_connected": True, "tls_succeeded": True,
        "http_status": http_result.get("status"),
        "html_title": http_result.get("title"),
        "block_reason": block_reason,
        "tcp_latency_ms": tcp_latency,
        "tls_latency_ms": tls_latency,
        "http_latency_ms": http_result.get("latency_ms"),
    }

async def submit_report(api_url: str, token: str, report: dict[str, Any]) -> tuple[bool, Optional[str]]:
    """Submit signed report to API."""
    signed = {**report, "signature": sign_report(token, report)}
    payload = json.dumps(signed).encode()
    try:
        req = urllib.request.Request(
            f"{api_url}/api/probes/report",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        resp = await asyncio.to_thread(urllib.request.urlopen, req)
        try:
            if resp.status != 200:
                body = await asyncio.to_thread(resp.read)
                return False, f"HTTP {resp.status}: {body.decode()}"
            return True, None
        finally:
            resp.close()
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.reason}"
    except Exception as e:
        return False, str(e)

# ─── Main ────────────────────────────────────────────────────────────────────

async def main() -> None:
    args = parse_args()
    token = args.token or load_token()

    if not token:
        print("ERROR: No probe token. Register at /api/probes/register or set PROBE_TOKEN.", file=sys.stderr)
        sys.exit(1)

    print("Detecting ASN..." if args.asn == 0 else "Using provided ASN...")
    asn = args.asn if args.asn else await detect_asn()
    print(f"ASN: {asn or '(unknown)'}")

    domains = args.domains or DEFAULT_DOMAINS
    state = load_state()
    probe_id = state["probe_id"]
    consecutive_failures = state.get("consecutive_failures", 0)

    async def run_cycle() -> None:
        nonlocal consecutive_failures
        print(f"[{datetime.now().isoformat()}] Probing {len(domains)} domains...")
        for domain in domains:
            try:
                report = await probe_domain(domain, token, probe_id, asn)
                if report is None:
                    continue
                ok, err = await submit_report(args.api_url, token, report)
                if ok:
                    consecutive_failures = 0
                    state["last_domain"] = domain
                    state["last_run"] = datetime.now().isoformat()
                    save_state(state)
                    print(f"  ✓ {domain}")
                else:
                    consecutive_failures += 1
                    print(f"  ✗ {domain}: {err}")
            except Exception as e:
                consecutive_failures += 1
                print(f"  ✗ {domain}: {e}")

        if consecutive_failures > 5:
            print(f"  ⚠ High failure rate ({consecutive_failures}). Backing off.")
            await asyncio.sleep(30)

    await run_cycle()

    if args.once:
        print("Single run complete.")
        return

    print(f"Continuous mode: probing every {args.interval}s")
    while True:
        await run_cycle()
        await asyncio.sleep(args.interval)

if __name__ == "__main__":
    asyncio.run(main())
