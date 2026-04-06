# Muslim Space Link Shortener (l.m-space.in)

A production-ready link shortener built with Cloudflare Workers, Hono, TypeScript, D1, KV, HTMX, and Tailwind CSS.

## Features

- **Link Management**: Create, edit, soft-delete, and reactivate links
- **Custom Aliases**: Support for custom short slugs
- **Analytics**: Track clicks, referrers, countries, and daily trends
- **QR Codes**: Generate SVG QR codes for each link
- **User Roles**: Owner, Admin, and Editor roles
- **Session-based Auth**: Secure login with session cookies
- **AI Stub**: Architecture ready for AI integration (OpenRouter, Ollama, CF AI Gateway, CF Workers AI)
- **Server-rendered**: Fast, SEO-friendly HTML with HTMX for interactivity

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Language**: TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **Frontend**: HTMX + Tailwind CSS (CDN)
- **Testing**: Vitest
- **Deployment**: Wrangler + GitHub Actions

## Project Structure

```
l-m-space-in/
├── migrations/           # D1 database migrations
│   ├── 001_initial.sql    # Schema creation
│   └── 002_seed_admin.sql # Seed default users
├── src/
│   ├── index.ts          # Entry point
│   ├── app.ts            # Main router
│   ├── config.ts         # Types and config
│   ├── db/               # Database utilities
│   ├── lib/              # Helper functions
│   ├── middleware/       # Auth middleware
│   ├── routes/           # Route handlers
│   │   ├── public.ts     # Redirect routes
│   │   ├── admin.ts      # Admin UI routes
│   │   └── api.ts        # JSON API routes
│   ├── services/         # Business logic
│   │   ├── links.ts      # Link CRUD
│   │   ├── analytics.ts  # Click tracking
│   │   ├── auth.ts       # Authentication
│   │   ├── qr.ts         # QR generation
│   │   └── ai.ts         # AI abstraction
│   ├── views/            # HTML templates
│   └── static/           # Static assets
├── tests/                # Test files
├── .github/workflows/    # CI/CD
├── wrangler.toml         # Worker config
├── package.json
├── tsconfig.json
└── .env.example
```

## Prerequisites

- Node.js 20+
- Cloudflare account
- Wrangler CLI (`npm i -g wrangler`)
- Git

## Local Development

### 1. Clone and Install

```bash
git clone <repository-url> l-m-space-in
cd l-m-space-in
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.dev.vars` and update:

```bash
cp .env.example .dev.vars
```

Edit `.dev.vars`:

```env
SESSION_SECRET=your-random-secret-key
JWT_SECRET=your-jwt-secret
SITE_URL=http://localhost:8787
SITE_NAME="Muslim Space Link"
SITE_DESCRIPTION="Official link shortener"
```

### 3. Create D1 Database

```bash
# Create D1 database
npx wrangler d1 create l-m-space-in

# Note the database ID and update wrangler.toml
```

### 4. Update wrangler.toml

Add your database ID and KV namespace ID to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "l-m-space-in"
database_id = "YOUR_DATABASE_ID"  # Replace with actual ID
```

### 5. Run Migrations

```bash
npx wrangler d1 execute l-m-space-in --local --file=migrations/001_initial.sql
npx wrangler d1 execute l-m-space-in --local --file=migrations/002_seed_admin.sql
```

### 6. Start Dev Server

```bash
npm run dev
```

The app will be available at `http://localhost:8787`

### 7. Default Login

After seeding, use these credentials:

- **Owner**: `hammad@example.com` / `owner123`
- **Admin**: `aakif@sham.si` / `admin123`

> ⚠️ **IMPORTANT**: Change these passwords immediately after first login!

## Deployment

### 1. Create Production Resources

```bash
# Create production D1 database
npx wrangler d1 create l-m-space-in-prod

# Create KV namespace
npx wrangler kv:namespace create CACHE

# Update wrangler.toml with production IDs
```

### 2. Deploy Worker

```bash
npm run deploy:production
```

### 3. Run Migrations on Production

```bash
npx wrangler d1 execute l-m-space-in-prod --remote --file=migrations/001_initial.sql
npx wrangler d1 execute l-m-space-in-prod --remote --file=migrations/002_seed_admin.sql
```

## GitHub Actions Setup

### 1. Create GitHub Repository

Push your code to GitHub.

### 2. Configure Secrets

In your GitHub repository settings, add these secrets:

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

### 3. Create API Token

1. Go to Cloudflare Dashboard > Profile > API Tokens
2. Create a custom token with these permissions:
   - Workers: Edit
   - D1: Edit
   - KV: Edit

### 4. Deploy

Push to `main` branch to trigger deployment.

## Usage

### Create a Link

1. Login at `/admin/login`
2. Go to Links > New Link
3. Enter destination URL
4. Optionally customize slug
5. Click "Create Link"

### View Analytics

1. Click on any link in the Links table
2. View click stats, referrers, and QR code

### Manage Users (Owner/Admin only)

1. Go to Settings > Users
2. Add, edit, or delete users

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:slug` | Redirect to long URL |
| GET | `/qr/:slug` | Get QR code SVG |
| GET | `/info/:slug` | Link preview page |
| GET | `/admin/login` | Login page |
| GET | `/admin/dashboard` | Admin dashboard |
| GET | `/admin/links` | Links list |
| GET | `/api/links` | List links (JSON) |

## Configuration

Edit settings in the admin panel or via D1:

```sql
-- View current settings
SELECT * FROM settings;

-- Update a setting
INSERT OR REPLACE INTO settings (key, value) VALUES ('site_name', 'My Link Shortener');
```

Available settings:
- `site_name`: Display name
- `site_description`: Site description
- `site_url`: Full URL of the site
- `default_redirect_type`: 301 or 302
- `links_per_page`: Pagination limit
- `ai_provider`: AI provider (none/openrouter/ollama/cf_gateway/cf_workers)

## Troubleshooting

### Database Issues

```bash
# Reset local database
rm .wrangler/state/d1/*
npx wrangler d1 execute l-m-space-in --local --file=migrations/001_initial.sql
```

### Cache Issues

```bash
# Clear KV cache
npx wrangler kv:key list --namespace-id=YOUR_KV_ID
```

### Deployment Issues

```bash
# Check for type errors
npm run typecheck

# View worker logs
npx wrangler tail
```

## License

MIT License - See LICENSE file for details.

## Credits

- Built with [Hono](https://hono.dev/) + [Cloudflare Workers](https://workers.cloudflare.com/)
- UI powered by [Tailwind CSS](https://tailwindcss.com/) + [HTMX](https://htmx.org/)