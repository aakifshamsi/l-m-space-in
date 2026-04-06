# Changelog

## [0.2.0] — 2026-04-06 — Sprint 1: Platform Foundation

### Security
- Removed hardcoded demo credentials (owner/admin) from login page — live on production
- Removed `demo_password` backdoor from auth service
- Scrubbed real API credentials from `.env.example` (CF token + BrowserBase key were committed)

### Added
- Master site routes for `m-space.in`: platform home, `/u/:handle` profiles, `/join` invite registration
- Invite-only registration system (`invite_codes` table, code validation, handle selection)
- User profiles (`user_profiles` table: handle, bio, tier, avatar)
- Master site layout — separate from admin layout, no "Muslim" branding
- Super-admin dashboard now serves HTML with real data from `sites` table (was hardcoded JSON)
- Migration 011: `user_profiles` + `invite_codes` tables

### Fixed
- `detectSiteType` — `l.m-space.in` was incorrectly matched as `master` (endsWith bug), breaking all link shortener routes including `/admin/login`
- CI/CD: removed `--env production` flag (no such env in wrangler.toml — was root cause of deployment failures)
- CI/CD: removed `working-directory: ./l-m-space-in` (repo root IS the project root, not a subdirectory)
- CI/CD: removed `cache-dependency-path: l-m-space-in/package-lock.json` (wrong path)
- CI/CD: removed automatic migration re-runs on every push (wrong DB name + re-run risk)
- CI/CD: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set as GitHub secrets

### Known Issues (logged for Sprint 2)
- `m-space.in` DNS still points to GitHub Pages / shared hosting — Worker route configured but not active; needs DNS switch
- `m-space.in/admin/super/dashboard` returns 404 until DNS is switched
- QR codes: default logo embed option missing (Sprint 3 scope)

## [0.1.0] — 2026-04-05 — Initial Build (KiloCode)

### Added
- Link shortener core: CRUD, short code generation, custom aliases, soft delete
- Redirect engine: KV-first, D1 fallback
- Click analytics: geo, device, referrer tracking
- Admin panel: dashboard, links, tags, settings, users
- Magic link authentication (passwordless)
- QR code generation
- Blog/CMS: pages, posts, auto-blog scaffolding
- Google Forms integration
- Multi-site detection (`main` / `edgy` / `master`)
- Super-admin routes scaffolded
- AI provider abstraction: Ollama, OpenRouter, CF Workers AI, BrowserBase env vars
- GitHub Actions CI/CD (broken — fixed in 0.2.0)
