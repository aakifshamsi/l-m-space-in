-- Google Forms Integration Tables
-- Migration 007

-- Store Google Forms configuration
CREATE TABLE IF NOT EXISTS form_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  google_form_id TEXT NOT NULL UNIQUE,
  google_sheet_id TEXT, -- for responses if linked
  embed_enabled INTEGER DEFAULT 1,
  track_submissions INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Store form-related protected links
CREATE TABLE IF NOT EXISTS protected_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_integration_id INTEGER,
  purpose TEXT NOT NULL, -- 'prefill', 'admin-review', etc.
  magic_token TEXT NOT NULL UNIQUE,
  prefill_data TEXT, -- JSON of field names → values
  expires_at DATETIME,
  used_count INTEGER DEFAULT 0,
  max_uses INTEGER,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (form_integration_id) REFERENCES form_integrations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Track form submission events
CREATE TABLE IF NOT EXISTS form_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_integration_id INTEGER,
  event_type TEXT NOT NULL, -- 'view', 'submit', 'error'
  responder_email TEXT,
  response_data TEXT, -- JSON
  ip_hash TEXT, -- hashed IP for deduplication
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (form_integration_id) REFERENCES form_integrations(id)
);

-- Seed the main form
INSERT OR IGNORE INTO form_integrations (name, google_form_id, embed_enabled, track_submissions)
VALUES ('Main Registration Form', '1FAIpQLSck1ga3SPhAnolsAh4HCmaTUw28_ZkpCXWsow6ZKjzHIWctCA', 1, 1);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_protected_links_token ON protected_links(magic_token);
CREATE INDEX IF NOT EXISTS idx_protected_links_form ON protected_links(form_integration_id);
CREATE INDEX IF NOT EXISTS idx_form_events_form ON form_events(form_integration_id);
CREATE INDEX IF NOT EXISTS idx_form_events_type ON form_events(event_type);
CREATE INDEX IF NOT EXISTS idx_form_events_created ON form_events(created_at);
