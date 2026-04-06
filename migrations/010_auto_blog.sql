-- 010_auto_blog.sql - Auto AI Blog Generation for M-Space
-- Adds support for AI-generated blog posts with scheduled posting

-- AI-generated posts table
CREATE TABLE IF NOT EXISTS auto_blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  category TEXT DEFAULT 'tech-news',
  source_topic TEXT,
  generation_prompt TEXT,
  ai_model TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'generated', 'scheduled', 'published')),
  scheduled_at DATETIME,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auto_blog_slug ON auto_blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_auto_blog_status ON auto_blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_auto_blog_scheduled ON auto_blog_posts(scheduled_at) WHERE status = 'scheduled';

-- Blog topics for auto-generation
CREATE TABLE IF NOT EXISTS blog_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  frequency TEXT DEFAULT 'weekly' CHECK(frequency IN ('daily', 'weekly', 'monthly')),
  last_generated DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default topics for M-Space
INSERT OR IGNORE INTO blog_topics (topic, category, frequency) VALUES
  ('URL shortening tips and best practices', 'tutorials', 'weekly'),
  ('Link management strategies for businesses', 'business', 'weekly'),
  ('New features in URL shorteners', 'product-updates', 'weekly'),
  ('Security best practices for shared links', 'security', 'monthly'),
  ('Analytics and tracking link performance', 'analytics', 'weekly'),
  ('Custom branded short links for marketing', 'marketing', 'monthly'),
  ('How to organize and categorize your links', 'tutorials', 'weekly'),
  ('The evolution of URL shorteners', 'history', 'monthly'),
  ('Mobile link sharing strategies', 'mobile', 'weekly'),
  ('QR codes and short links: A perfect combination', 'qr-codes', 'monthly');

-- Settings for auto-blog
INSERT OR IGNORE INTO settings (key, value) VALUES 
  ('auto_blog_enabled', 'false'),
  ('auto_blog_frequency', 'weekly'),
  ('auto_blog_categories', 'tutorials,product-updates,tech-news'),
  ('auto_blog_post_status', 'published');
