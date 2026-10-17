FROM python:3.11-slim

WORKDIR /probe

COPY probe.py .
COPY .probe_token /probe/.probe_token 2>/dev/null || true

ENV PROBE_API_URL=http://api:8787
ENV PROBE_INTERVAL=60

# One-liner to run: docker run -e PROBE_TOKEN=<token> -e PROBE_API_URL=https://api.example.com isitdownforturkey/probe
CMD ["python3", "probe.py"]
