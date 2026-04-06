-- 004_features_and_handles.sql - Add new features for l.m-space.in
-- Run this migration to add:
-- 1. Ad-free option for links (enabled by default for admins)
-- 2. Multiple social handles support
-- 3. Enable Instagram embedding for Instagram URLs

-- ad_free column already exists on remote links table (added manually/previously)
-- Removed: ALTER TABLE links ADD COLUMN IF NOT EXISTS ad_free INTEGER DEFAULT 0;

-- Create handles table for multiple social media profiles
CREATE TABLE IF NOT EXISTS handles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL CHECK(platform IN ('instagram', 'twitter', 'tiktok', 'youtube', 'facebook', 'linkedin', 'other')),
    handle TEXT NOT NULL,
    url TEXT NOT NULL,
    display_name TEXT,
    is_enabled INTEGER DEFAULT 0,
    is_primary INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for enabled handles
CREATE INDEX IF NOT EXISTS idx_handles_is_enabled ON handles(is_enabled);

-- Insert default handles
-- Thisisbilhates - Instagram handle (DISABLED by default as requested)
INSERT INTO handles (platform, handle, url, display_name, is_enabled, is_primary) VALUES 
('instagram', 'thisisbilhates', 'https://instagram.com/thisisbilhates', 'This is Bil Hates', 0, 0);

-- Insert settings for new features
INSERT OR IGNORE INTO settings (key, value) VALUES ('hide_referrer', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('custom_referrer', 'digitalhands.in');
INSERT OR IGNORE INTO settings (key, value) VALUES ('instagram_embed', 'true');