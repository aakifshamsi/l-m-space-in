-- ===============================================
-- Form Automation System Migration
-- Events, Volunteers, Blog, WhatsApp
-- ===============================================

-- ===============================================
-- EVENTS MODULE
-- ===============================================

-- Events table for creating and managing events
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATETIME,
  end_date DATETIME,
  location TEXT,
  location_url TEXT,
  max_attendees INTEGER,
  registration_open INTEGER DEFAULT 1,
  registration_deadline DATETIME,
  cost DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  image_url TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Event registrations for tracking attendees
CREATE TABLE IF NOT EXISTS event_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER,
  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  status TEXT DEFAULT 'registered' CHECK(status IN ('registered', 'waitlisted', 'attended', 'cancelled', 'no_show')),
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Unique constraint: one registration per email per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registration_unique 
ON event_registrations(event_id, email);

-- Index for looking up registrations by event
CREATE INDEX IF NOT EXISTS idx_event_registrations_event 
ON event_registrations(event_id);

-- Index for looking up registrations by user
CREATE INDEX IF NOT EXISTS idx_event_registrations_user 
ON event_registrations(user_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_event_registrations_status 
ON event_registrations(status);

-- ===============================================
-- VOLUNTEERS MODULE
-- ===============================================

-- Volunteers table for tracking volunteer information
CREATE TABLE IF NOT EXISTS volunteers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  site_id INTEGER,
  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  skills TEXT, -- JSON array of skill tags
  interests TEXT, -- JSON array of interest areas
  availability TEXT, -- JSON schedule object
  experience_level TEXT DEFAULT 'beginner' CHECK(experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  total_hours DECIMAL(10,1) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
  background_check_status TEXT DEFAULT 'pending' CHECK(background_check_status IN ('pending', 'in_progress', 'completed', 'failed')),
  emergency_contact TEXT,
  emergency_phone TEXT,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Index for looking up volunteers by user
CREATE INDEX IF NOT EXISTS idx_volunteers_user 
ON volunteers(user_id);

-- Index for looking up volunteers by site
CREATE INDEX IF NOT EXISTS idx_volunteers_site 
ON volunteers(site_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_volunteers_status 
ON volunteers(status);

-- Volunteer hours log for tracking time contributed
CREATE TABLE IF NOT EXISTS volunteer_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volunteer_id INTEGER NOT NULL,
  event_id INTEGER,
  hours DECIMAL(5,1) NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  description TEXT,
  category TEXT CHECK(category IN ('event', 'admin', 'outreach', 'training', 'other')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  approved_by INTEGER,
  approved_at DATETIME,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for looking up hours by volunteer
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_volunteer 
ON volunteer_hours(volunteer_id);

-- Index for looking up hours by event
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_event 
ON volunteer_hours(event_id);

-- Index for approval workflow
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_status 
ON volunteer_hours(status);

-- ===============================================
-- BLOG / CONTENT SUBMISSIONS MODULE
-- ===============================================

-- Blog submissions for user-submitted articles
CREATE TABLE IF NOT EXISTS blog_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER,
  user_id INTEGER,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image TEXT,
  category TEXT,
  tags TEXT, -- JSON array
  status TEXT DEFAULT 'pending' CHECK(status IN ('draft', 'pending', 'approved', 'rejected', 'published')),
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  review_notes TEXT,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for looking up submissions by site
CREATE INDEX IF NOT EXISTS idx_blog_submissions_site 
ON blog_submissions(site_id);

-- Index for looking up submissions by user
CREATE INDEX IF NOT EXISTS idx_blog_submissions_user 
ON blog_submissions(user_id);

-- Index for status filtering (moderation queue)
CREATE INDEX IF NOT EXISTS idx_blog_submissions_status 
ON blog_submissions(status);

-- Index for published articles
CREATE INDEX IF NOT EXISTS idx_blog_submissions_published 
ON blog_submissions(published_at) WHERE status = 'published';

-- ===============================================
-- WHATSAPP NOTIFICATIONS MODULE
-- ===============================================

-- WhatsApp notifications log for tracking sent messages
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER,
  phone TEXT NOT NULL,
  contact_name TEXT,
  message TEXT NOT NULL,
  template_name TEXT,
  template_variables TEXT, -- JSON object
  message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'template', 'image', 'document', 'location')),
  media_url TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'bounced')),
  whatsapp_message_id TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  scheduled_at DATETIME,
  sent_at DATETIME,
  delivered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Index for looking up notifications by site
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_site 
ON whatsapp_notifications(site_id);

-- Index for looking up notifications by phone
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_phone 
ON whatsapp_notifications(phone);

-- Index for status tracking
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_status 
ON whatsapp_notifications(status);

-- Index for scheduled notifications
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_scheduled 
ON whatsapp_notifications(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- WhatsApp contacts for managing subscriber list
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  opt_in INTEGER DEFAULT 1,
  opt_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  opt_out_at DATETIME,
  source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'event_registration', 'volunteer_signup', 'web_signup', 'import')),
  last_message_at DATETIME,
  tags TEXT, -- JSON array for segmentation
  metadata TEXT, -- JSON object for additional data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Unique phone number per site
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone_site 
ON whatsapp_contacts(phone, site_id);

-- Index for looking up contacts by site
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_site 
ON whatsapp_contacts(site_id);

-- Index for opt-in status
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_optin 
ON whatsapp_contacts(opt_in) WHERE opt_in = 1;

-- ===============================================
-- AUTOMATED WORKFLOWS
-- ===============================================

-- Automated workflow rules
CREATE TABLE IF NOT EXISTS workflow_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN (
    'event_created', 'event_reminder', 'event_registration', 'event_cancelled',
    'volunteer_signup', 'volunteer_hours_logged', 'volunteer_hours_approved',
    'blog_submitted', 'blog_approved', 'blog_rejected',
    'user_signup', 'user_action', 'scheduled'
  )),
  conditions TEXT, -- JSON object with conditions
  actions TEXT NOT NULL, -- JSON array of actions to perform
  is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for trigger types
CREATE INDEX IF NOT EXISTS idx_workflow_rules_trigger 
ON workflow_rules(trigger_type);

-- Index for active rules
CREATE INDEX IF NOT EXISTS idx_workflow_rules_active 
ON workflow_rules(is_active) WHERE is_active = 1;

-- Workflow execution log
CREATE TABLE IF NOT EXISTS workflow_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  trigger_type TEXT NOT NULL,
  context TEXT, -- JSON object with trigger context
  actions_executed TEXT, -- JSON array of executed actions
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  error_message TEXT,
  FOREIGN KEY (rule_id) REFERENCES workflow_rules(id) ON DELETE CASCADE
);

-- Index for looking up executions by rule
CREATE INDEX IF NOT EXISTS idx_workflow_executions_rule 
ON workflow_executions(rule_id);

-- Index for status
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status 
ON workflow_executions(status);

-- ===============================================
-- DATA SEEDING (Optional sample data)
-- ===============================================

-- Insert sample event categories
-- INSERT INTO categories (name, type, slug) VALUES 
--   ('Community Event', 'event_category', 'community-event'),
--   ('Workshop', 'event_category', 'workshop'),
--   ('Meeting', 'event_category', 'meeting'),
--   ('Fundraiser', 'event_category', 'fundraiser');
