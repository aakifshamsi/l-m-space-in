-- 002_seed_admin.sql - Seed admin users for l.m-space.in
-- IMPORTANT: Change these passwords immediately after first login!

-- Password hash for "owner123" (SHA-256 based simple hash for demo - USE STRONG HASH IN PRODUCTION)
-- In production, use proper bcrypt hashes
-- These are placeholder hashes - user should change on first login
-- Using simple SHA256 for demo purposes: hash("owner123" + "l-m-space-in")
-- For real deployment, use bcrypt hashes

-- Insert Owner: Sir Hammad Ahmad
-- Password: owner123 (change immediately!)
-- Note: In production, use proper password hashing library
INSERT OR IGNORE INTO users (email, password_hash, role, name) VALUES
('hammad@example.com', 'a47e78e462e1d7a9d26a53552eca9ee478e93e828d112f7ee25c2d4bdf431aa6', 'owner', 'Sir Hammad Ahmad');

-- Insert Admin: aakif@sham.si
-- Password: admin123 (change immediately!)
INSERT OR IGNORE INTO users (email, password_hash, role, name) VALUES
('aakif@sham.si', 'af8ca64002d5c210b65d89982cba03b04927eb7072265bc5f8ee1ef2a17a29a5', 'admin', 'Aakif');

-- Insert default domain
INSERT OR IGNORE INTO domains (domain, is_primary) VALUES
('l.m-space.in', 1);

-- Add some sample tags
INSERT OR IGNORE INTO tags (name, color) VALUES
('important', '#ef4444'),
('marketing', '#f59e0b'),
('social', '#10b981'),
('documentation', '#3b82f6');

-- Add sample activity
INSERT OR IGNORE INTO activity_log (user_id, action, details) VALUES
(1, 'system', 'System initialized - database seeded'),
(2, 'system', 'Admin account created');

-- Note on passwords:
-- The password hashes above are placeholders. For a production system:
-- 1. Use a proper bcrypt library
-- 2. Generate real hashes for the default passwords
-- 3. Force password change on first login
-- 
-- To set real passwords, you can use a script or update directly:
-- UPDATE users SET password_hash = '$2b$12$...' WHERE email = '...';
--
-- For testing, you can set a known hash. Example (password: "admin123"):
-- The hash needs to be a valid bcrypt hash