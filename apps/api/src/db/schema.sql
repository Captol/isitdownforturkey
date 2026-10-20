-- D1 Schema for isitdownforturkey
-- Schema: domains, measurements, probe_nodes, hourly_rollups
-- No PII stored; client IPs discarded server-side after ASN derivation

CREATE TABLE IF NOT EXISTS domains (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  domain     TEXT NOT NULL UNIQUE,
  category   TEXT,
  watchlist  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS measurements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id    INTEGER NOT NULL REFERENCES domains(id),
  source       TEXT NOT NULL CHECK(source IN ('global','probe','browser')),
  probe_id     INTEGER,
  asn          INTEGER,
  isp          TEXT,
  status       TEXT NOT NULL CHECK(status IN ('up','blocked','down','degraded','unknown')),
  block_reason TEXT,
  latency_ms   REAL,
  payload      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meas_domain ON measurements(domain_id);
CREATE INDEX IF NOT EXISTS idx_meas_isp ON measurements(isp);
CREATE INDEX IF NOT EXISTS idx_meas_time ON measurements(created_at);

CREATE TABLE IF NOT EXISTS probe_nodes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  probe_id        TEXT NOT NULL UNIQUE,
  hmac_key_hash   TEXT NOT NULL,
  token           TEXT NOT NULL,
  asn             INTEGER,
  isp             TEXT,
  reputation      REAL NOT NULL DEFAULT 1.0,
  reports_total   INTEGER NOT NULL DEFAULT 0,
  reports_valid   INTEGER NOT NULL DEFAULT 0,
  last_seen       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hourly_rollups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id     INTEGER NOT NULL REFERENCES domains(id),
  isp           TEXT,
  hour_bucket   TEXT NOT NULL,
  up_count      INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  down_count    INTEGER NOT NULL DEFAULT 0,
  avg_latency   REAL,
  UNIQUE(domain_id, isp, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_rollups ON hourly_rollups(domain_id, isp, hour_bucket);