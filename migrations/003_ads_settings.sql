-- 003_ads_settings.sql - Add ads control settings
-- Run this migration to add enable_ads and ads_on_redirects settings

-- Add ads settings if they don't exist
INSERT OR IGNORE INTO settings (key, value) VALUES ('enable_ads', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('ads_on_redirects', 'true');