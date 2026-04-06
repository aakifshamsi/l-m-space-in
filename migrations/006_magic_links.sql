-- 006_magic_links.sql - Magic Links Authentication
-- Run this migration to add magic links table for passwordless authentication

-- Magic Links table for passwordless authentication
CREATE TABLE IF NOT EXISTS magic_links (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast token lookup during verification
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token_hash);

-- Index for listing user's magic links
CREATE INDEX IF NOT EXISTS idx_magic_links_user ON magic_links(user_id);

-- Rate limiting for magic link requests (email -> count -> window)
CREATE TABLE IF NOT EXISTS magic_link_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    window_start TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    UNIQUE(email, window_start)
);

CREATE INDEX IF NOT EXISTS idx_magic_link_rl_email ON magic_link_rate_limits(email);
CREATE INDEX IF NOT EXISTS idx_magic_link_rl_window ON magic_link_rate_limits(window_start);

-- Settings for magic link configuration
INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('magic_link_enabled', 'true'),
    ('magic_link_expiry_minutes', '15'),
    ('magic_link_rate_limit', '5'),
    ('magic_link_rate_window_hours', '1');
