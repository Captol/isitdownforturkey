# Volunteer Probe Guide / Gönüllü Probe Rehberi

> This guide explains how to run a probe agent from Türkiye and contribute
> measurements to the isitdownforturkey network. No programming experience needed.

---

## English

### What is a probe?

A probe is a lightweight script that checks whether websites are reachable from
your location in Türkiye. It runs periodically (default: every 60 seconds) and
sends signed reports to our API. Your IP address is never stored — only your
ISP's ASN (Autonomous System Number) is recorded.

### What data does it collect?

- **DNS resolution**: System DNS vs. DoH (Cloudflare/Google) — detects DNS poisoning
- **TCP connectivity**: Can your ISP reach port 443?
- **TLS handshake**: Does TLS complete successfully? Detects SNI resets
- **HTTP response**: Status code and page title — detects BTK block pages
- **Latency**: Time to connect

Nothing else. No browsing history, no cookies, no personal data.

### How to run (Node.js)

**Step 1 — Get a token**

Register once at the API:

```bash
curl -X POST https://isitdownforturkey.pages.dev/api/probes/register \
  -H "Content-Type: application/json" \
  -d '{"asn": 9121}'
# → { "probeId": "...", "token": "..." }
```

**Step 2 — Run the probe**

```bash
# Set environment variables
export PROBE_TOKEN=<your-token>
export PROBE_API_URL=https://isitdownforturkey.pages.dev

# Run once to test
node index.js --once

# Run continuously
node index.js
```

**Step 3 — Run on a schedule (optional)**

On Linux/macOS, add to crontab (`crontab -e`):
```
*/5 * * * * cd ~/isitdownforturkey/packages/probe && node index.js
```

On Windows, use Task Scheduler to run `node index.js` every 5 minutes.

### How to run (Python)

```bash
export PROBE_TOKEN=<your-token>
export PROBE_API_URL=https://isitdownforturkey.pages.dev

# Run once
python probe.py --once

# Run continuously
python probe.py
```

### How to run (Docker)

```bash
docker run \
  -e PROBE_TOKEN=<your-token> \
  -e PROBE_API_URL=https://isitdownforturkey.pages.dev \
  isitdownforturkey/probe
```

### Supported Turkish ISPs (ASN reference)

| ISP | ASN |
|-----|-----|
| Türk Telekom | 9121 |
| Turkcell Superonline | 34984 |
| TurkNet | 12735 |
| Vodafone TR | 15897 |
| Türksat/Kablonet | 47524 |
| Ziraat Bankası | 44722 |
| Other / Unknown | (auto-detected) |

### Security

- Reports are HMAC-SHA256 signed with your unique token
- Your IP is never stored; only the ASN is recorded server-side
- Rate limited: 30 reports/min per probe node
- The probe reads no private files or environment variables beyond its token

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `invalid signature` | Token expired or wrong. Re-register at `/api/probes/register` |
| `rate limited` | You've sent too many reports. Wait 60s or reduce interval |
| `ASN mismatch` | Probe ASN doesn't match registered ASN. Update registration or check `--asn` flag |
| No reports sent | Check `PROBE_API_URL` and network connectivity |

---

## Türkçe

### Probe nedir?

Probe, Türkiye'den hangi web sitelerinin erişilebilir olduğunu kontrol eden
hafif bir betiktir. Belirli aralıklarla (varsayılan: her 60 saniye) çalışır ve
imzalanmış raporları API'ye gönderir. IP adresiniz asla kaydedilmez — sadece
ISP'nizin ASN (Autonomous System Number) numarası kaydedilir.

### Hangi verileri toplar?

- **DNS çözümleme**: Sistem DNS'si vs. DoH (Cloudflare/Google) — DNS zehirlemesi tespiti
- **TCP bağlantısı**: ISP'niz port 443'e ulaşabiliyor mu?
- **TLS el sıkışması**: TLS başarılı oldu mu? SNI sıfırlamalarını tespit eder
- **HTTP yanıtı**: Durum kodu ve sayfa başlığı — BTK engel sayfalarını tespit eder
- **Gecikme**: Bağlantı süresi

Başka hiçbir şey. Tarama geçmişi yok, çerez yok, kişisel veri yok.

### Nasıl çalıştırılır (Node.js)

**Adım 1 — Token alın**

API'den bir kez kayıt olun:

```bash
curl -X POST https://isitdownforturkey.pages.dev/api/probes/register \
  -H "Content-Type: application/json" \
  -d '{"asn": 9121}'
# → { "probeId": "...", "token": "..." }
```

**Adım 2 — Probe'ı çalıştırın**

```bash
# Ortam değişkenlerini ayarlayın
export PROBE_TOKEN=<tokenunuz>
export PROBE_API_URL=https://isitdownforturkey.pages.dev

# Bir kez test edin
node index.js --once

# Sürekli çalıştırın
node index.js
```

**Adım 3 — Zamanlamaya ekleyin (isteğe bağlı)**

Linux/macOS'te crontab'a ekleyin (`crontab -e`):
```
*/5 * * * * cd ~/isitdownforturkey/packages/probe && node index.js
```

Windows'ta Görev Zamanlayıcısı ile `node index.js`'i her 5 dakikada bir çalıştırın.

### Nasıl çalıştırılır (Python)

```bash
export PROBE_TOKEN=<tokenunuz>
export PROBE_API_URL=https://isitdownforturkey.pages.dev

# Bir kez çalıştırın
python probe.py --once

# Sürekli çalıştırın
python probe.py
```

### Nasıl çalıştırılır (Docker)

```bash
docker run \
  -e PROBE_TOKEN=<tokenunuz> \
  -e PROBE_API_URL=https://isitdownforturkey.pages.dev \
  isitdownforturkey/probe
```

### Desteklenen Türk ISP'leri (ASN referansı)

| ISP | ASN |
|-----|-----|
| Türk Telekom | 9121 |
| Turkcell Superonline | 34984 |
| TurkNet | 12735 |
| Vodafone TR | 15897 |
| Türksat/Kablonet | 47524 |
| Ziraat Bankası | 44722 |
| Diğer / Bilinmeyen | (otomatik algılanır) |

### Güvenlik

- Raporlar benzersiz token'ınızla HMAC-SHA256 ile imzalanır
- IP adresiniz asla kaydedilmez; sunucu tarafında sadece ASN kaydedilir
- Hız sınırı: probe başına dakikada 30 rapor
- Probe, token'ınız dışında özel dosya veya ortam değişkeni okumaz

### Sorun giderme

| Belirti | Çözüm |
|---------|-------|
| `invalid signature` | Token süresi dolmuş veya yanlış. `/api/probes/register`'dan tekrar kayıt olun |
| `rate limited` | Çok fazla rapor gönderdiniz. 60 saniye bekleyin veya aralığı azaltın |
| `ASN mismatch` | Probe ASN'i kayıtlı ASN ile uyuşmuyor. Kaydı güncelleyin veya `--asn` bayrağını kontrol edin |
| Rapor gönderilmiyor | `PROBE_API_URL`'i ve ağ bağlantısını kontrol edin |
