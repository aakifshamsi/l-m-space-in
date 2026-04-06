# DNS Setup Guide: frii.site

> Actionable setup instructions for `frii.site` and `edgy.frii.site` DNS.
> **Current state**: `frii.site` has `A → 0.0.0.0` (parked). DNS registrar unknown.

---

## Quick Decision: Two Approaches

### Option A — CF Worker Custom Domain (Recommended for MVP)

`edgy.frii.site` points directly to the Cloudflare Worker. The worker handles everything — landing page, API, and redirects. Single deployment, no CORS issues, sub-10ms redirects.

### Option B — GitHub Pages Frontend + CF Worker API (Future/Scale)

`edgy.frii.site` points to GitHub Pages for a fully custom static frontend. API calls go cross-origin to `l.m-space.in/api/*`. Better for rich landing pages with unique designs per site, but adds CORS complexity and redirect latency.

---

## Option A: CF Worker Custom Domain (MVP)

### DNS Records

> **Prerequisite**: `frii.site` must be added as a zone in Cloudflare (free plan).

| Record Type | Name | Value | TTL | Proxy Status |
|-------------|------|-------|-----|-------------|
| `A` | `frii.site` | `192.0.2.1` | Auto | ☁️ Proxied |
| `CNAME` | `edgy` | `l.m-space.in` | Auto | ☁️ Proxied |
| `CNAME` | `www` | `frii.site` | Auto | ☁️ Proxied |

> **Note on `frii.site` root A record**: The `192.0.2.1` value is a dummy — Cloudflare proxied mode means the IP is never exposed. The Worker route will intercept all traffic. You could also use `100.64.0.1` or any non-routable IP. This is the standard pattern for CF Workers on apex domains.

### Step-by-Step Setup

#### Step 1: Add `frii.site` to Cloudflare

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Add a Site** → enter `frii.site`
3. Select the **Free** plan
4. Cloudflare will scan existing DNS records — delete the `A → 0.0.0.0` parked record
5. Add the DNS records from the table above
6. Cloudflare will give you two nameservers (e.g., `adam.ns.cloudflare.com`, `betty.ns.cloudflare.com`)

#### Step 2: Update Nameservers at Registrar

1. Find where `frii.site` is registered (check email for domain purchase receipts, or try Namecheap / Porkbun / GoDaddy / Google Domains)
2. Go to the registrar's DNS settings for `frii.site`
3. Replace the current nameservers with the two Cloudflare nameservers from Step 1
4. Wait for propagation — usually 10 min to 24 hours. Check with: `dig frii.site NS`

#### Step 3: Verify Zone is Active

1. Back in Cloudflare Dashboard → `frii.site` zone
2. The status should change from "Pending" to **"Active"**
3. Verify DNS resolution:
   ```bash
   dig edgy.frii.site CNAME
   # Should return: edgy.frii.site. CNAME l.m-space.in.
   
   dig edgy.frii.site A
   # Should return Cloudflare IPs (proxied)
   ```

#### Step 4: Update `wrangler.toml`

Add the `frii.site` routes to the existing routes array:

```toml
routes = [
  { pattern = "https://l.m-space.in/*", zone_name = "m-space.in" },
  { pattern = "https://edgy.frii.site/*", zone_name = "frii.site" },
  { pattern = "https://frii.site/*", zone_name = "frii.site" }
]
```

#### Step 5: Deploy and Verify

```bash
npx wrangler deploy
```

Then test:

```bash
# Should return the worker response (landing page or redirect)
curl -I https://edgy.frii.site/
curl -I https://frii.site/
```

### Codebase Changes for Option A

| File | Change |
|------|--------|
| [`wrangler.toml`](../wrangler.toml) | Add two new routes for `frii.site` zone (see Step 4) |
| [`src/index.ts`](../src/index.ts:11) | No CORS changes needed — same-origin since worker serves everything |
| Site resolver middleware | Add hostname matching for `edgy.frii.site` → `site_id=2` and `frii.site` → root landing |

The site resolver already uses the `Host` header to determine `site_id`. Adding `edgy.frii.site` to the `sites` table with `domain = 'edgy.frii.site'` is sufficient — no middleware code changes if the resolver uses DB lookup.

---

## Option B: GitHub Pages Frontend + CF Worker API (Future)

### DNS Records

> `frii.site` does **NOT** need to be a Cloudflare zone for this option.
> DNS can stay at any registrar. No proxy status applies.

| Record Type | Name | Value | TTL | Notes |
|-------------|------|-------|-----|-------|
| `A` | `frii.site` | `185.199.108.153` | 3600 | GitHub Pages IP 1 of 4 |
| `A` | `frii.site` | `185.199.109.153` | 3600 | GitHub Pages IP 2 of 4 |
| `A` | `frii.site` | `185.199.110.153` | 3600 | GitHub Pages IP 3 of 4 |
| `A` | `frii.site` | `185.199.111.153` | 3600 | GitHub Pages IP 4 of 4 |
| `CNAME` | `edgy` | `<org>.github.io` | 3600 | Replace `<org>` with GitHub org/user name |
| `CNAME` | `www` | `<org>.github.io` | 3600 | Replace `<org>` with GitHub org/user name |

### GitHub Pages Setup

1. **Verify domain in GitHub**: Go to GitHub → Settings → Pages → Add `edgy.frii.site` as a verified domain
2. **CNAME file**: Create a `CNAME` file in the GH Pages deploy root containing:
   ```
   edgy.frii.site
   ```
3. **Enable HTTPS**: In repo Settings → Pages → check "Enforce HTTPS" (GitHub auto-provisions Let's Encrypt)
4. **DNS verification TXT record** (GitHub may require):
   | Record Type | Name | Value |
   |-------------|------|-------|
   | `TXT` | `_github-pages-challenge-<org>` | `<token from GitHub>` |

### Codebase Changes for Option B

| File | Change |
|------|--------|
| [`wrangler.toml`](../wrangler.toml) | No changes — worker stays at `l.m-space.in` only |
| [`src/index.ts`](../src/index.ts:11) | Update CORS `origin: '*'` to allowlist including `https://edgy.frii.site` and `https://frii.site` |
| [`src/index.ts`](../src/index.ts:14) | Add `'X-Site-Key'` to `allowHeaders` |
| Site resolver middleware | Add `X-Site-Key` header extraction + `Origin` cross-check (see [HYBRID_MULTISITE_GH_CF.md](./HYBRID_MULTISITE_GH_CF.md) Section 4.2) |
| `sites` table | Add `api_key` column for site key authentication |

**CORS config change** (in [`index.ts`](../src/index.ts:11)):

```typescript
app.use('/api/*', cors({
  origin: [
    'https://l.m-space.in',
    'https://edgy.frii.site',
    'https://frii.site',
    'https://www.frii.site',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Site-Key'],
  maxAge: 86400,
}));
```

---

## Quick Reference: Full DNS Ecosystem

| Domain | Record Type | Value | Managed In | Proxy | Status |
|--------|------------|-------|-----------|-------|--------|
| `m-space.in` | `A` | `23.88.7.244` | Cloudflare | — | ⚠️ DO NOT TOUCH |
| `www.m-space.in` | `A` | `23.88.7.244` | Cloudflare | — | ⚠️ DO NOT TOUCH |
| `l.m-space.in` | Worker Route | `l-m-space-in/*` | Cloudflare | ☁️ Proxied | ✅ Active |
| **`frii.site`** | `A` | `192.0.2.1` (dummy) | Cloudflare (new zone) | ☁️ Proxied | 🆕 Option A |
| **`edgy.frii.site`** | `CNAME` | `l.m-space.in` | Cloudflare (frii.site zone) | ☁️ Proxied | 🆕 Option A |
| `frii.site` | `A` ×4 | `185.199.108-111.153` | Any registrar | — | 🆕 Option B |
| `edgy.frii.site` | `CNAME` | `<org>.github.io` | Any registrar | — | 🆕 Option B |

> **Choose one row set**: either the Option A rows (CF Worker) or Option B rows (GH Pages), not both.

---

## FAQ

**Q: Where is `frii.site` registered?**
Unknown. Check email for purchase receipts. Common registrars: Namecheap, Porkbun, Cloudflare Registrar, GoDaddy, Google Domains. Run `whois frii.site` to check.

**Q: Can I use Option A now and switch to Option B later?**
Yes. Option A is self-contained. To switch, you would remove the `frii.site` routes from `wrangler.toml`, update DNS records to point to GitHub Pages instead of CF, and add the CORS/site-key changes.

**Q: Do I need to pay for Cloudflare?**
No. The Cloudflare free plan supports custom domains, DNS management, and Worker routes. The existing Worker is already on a free plan.

**Q: What about `frii.site` root domain in Option A?**
The `frii.site` Worker route can serve a landing page that redirects to `edgy.frii.site`, or render its own marketing page. This is controlled by the site resolver middleware matching the `Host` header.

---

*Created: 2026-04-05*
*Related: [EDGY_FRII_SITE_SPEC.md](./EDGY_FRII_SITE_SPEC.md) · [HYBRID_MULTISITE_GH_CF.md](./HYBRID_MULTISITE_GH_CF.md)*
