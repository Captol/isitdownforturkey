# isitdownforturkey CLI

Check if a website is reachable from Türkiye from your terminal.

## Install

```bash
npx isitdownforturkey <domain>
```

No installation needed — runs directly from npm.

## Usage

```bash
# Quick check
npx isitdownforturkey github.com

# JSON output (for scripts)
npx isitdownforturkey discord.com --json

# Custom API URL
npx isitdownforturkey example.com --api-url http://localhost:8787
```

## Output

Human-readable verdict with confidence, DNS/HTTPS baseline, and ISP sources.

## License

MIT
