-- 005_ai_trial.sql - AI Trial and Usage Tracking
-- Run this migration to add AI subscription and usage tables

-- AI Subscriptions table for trial management
CREATE TABLE IF NOT EXISTS ai_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_type TEXT DEFAULT 'trial' CHECK(plan_type IN ('trial', 'free', 'pro', 'enterprise')),
    trial_start TEXT,
    trial_end TEXT,
    credits_remaining INTEGER DEFAULT 100,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_subscriptions_user_id ON ai_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_subscriptions_is_active ON ai_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_subscriptions_trial_end ON ai_subscriptions(trial_end);

-- AI Usage tracking table
CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    feature_type TEXT NOT NULL CHECK(feature_type IN ('blog_content', 'social_caption', 'link_description', 'hashtag_suggestion')),
    credits_used INTEGER DEFAULT 1,
    model_used TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_type ON ai_usage(feature_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);

-- Insert default AI settings
INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('ai_enabled', 'false'),
    ('ai_ollama_endpoint', 'http://localhost:11434'),
    ('ai_ollama_model', 'llama3'),
    ('ai_openrouter_api_key', ''),
    ('ai_openrouter_model', 'anthropic/claude-3-haiku'),
    ('ai_trial_days', '30'),
    ('ai_trial_credits', '100'),
    ('ai_daily_reset', 'true');
