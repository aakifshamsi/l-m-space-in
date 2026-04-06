-- Multi-site Support Migration
-- Adds sites table for tracking multiple site deployments

-- Sites table for multi-site configuration
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subdomain TEXT NOT NULL,
  domain TEXT NOT NULL,
  domain_type TEXT DEFAULT 'subdomain' CHECK(domain_type IN ('subdomain', 'custom_domain')),
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending_dns', 'suspended')),
  max_links INTEGER DEFAULT 10,
  max_clicks_per_month INTEGER DEFAULT 500,
  enable_ads INTEGER DEFAULT 1,
  interstitial_ads INTEGER DEFAULT 0,
  custom_domains INTEGER DEFAULT 0,
  analytics_level TEXT DEFAULT 'basic' CHECK(analytics_level IN ('basic', 'advanced', 'none')),
  branding TEXT DEFAULT 'default' CHECK(branding IN ('default', 'minimal', 'none')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default sites
INSERT OR IGNORE INTO sites (id, name, subdomain, domain, domain_type, plan, status, max_links, max_clicks_per_month, enable_ads, interstitial_ads, custom_domains, analytics_level, branding)
VALUES 
  (1, 'Muslim Space Link', 'l', 'm-space.in', 'subdomain', 'pro', 'active', 1000, 100000, 1, 0, 1, 'advanced', 'minimal'),
  (2, 'Edgy Links', 'edgy', 'frii.site', 'custom_domain', 'free', 'pending_dns', 10, 500, 1, 1, 0, 'basic', 'default');

-- Site-specific settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  UNIQUE(site_id, key)
);

-- Insert default settings for main site
INSERT OR IGNORE INTO site_settings (site_id, key, value)
VALUES 
  (1, 'primary_color', '#1a73e8'),
  (1, 'logo_url', ''),
  (1, 'custom_branding', 'true');

-- Insert default settings for edgy site
INSERT OR IGNORE INTO site_settings (site_id, key, value)
VALUES 
  (2, 'primary_color', '#FF6B35'),
  (2, 'secondary_color', '#1A365D'),
  (2, 'logo_url', ''),
  (2, 'tagline', 'Links that hit different 😎');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
CREATE INDEX IF NOT EXISTS idx_site_settings_site_id ON site_settings(site_id);
