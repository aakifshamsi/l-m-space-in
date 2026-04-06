// ===============================================
// Form Automation System Types
// Events, Volunteers, Blog, WhatsApp
// ===============================================

// ===============================================
// EVENTS
// ===============================================

export interface Event {
  id: number;
  site_id: number | null;
  title: string;
  description: string | null;
  event_date: string | null;
  end_date: string | null;
  location: string | null;
  location_url: string | null;
  max_attendees: number | null;
  registration_open: number;
  registration_deadline: string | null;
  cost: number;
  currency: string;
  image_url: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: number;
  event_id: number;
  user_id: number | null;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  status: 'registered' | 'waitlisted' | 'attended' | 'cancelled' | 'no_show';
  registered_at: string;
  updated_at: string;
  notes: string | null;
}

export interface EventWithStats extends Event {
  registration_count: number;
  attendee_count: number;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  event_date?: string;
  end_date?: string;
  location?: string;
  location_url?: string;
  max_attendees?: number;
  registration_open?: boolean;
  registration_deadline?: string;
  cost?: number;
  currency?: string;
  image_url?: string;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
  id: number;
}

export interface EventRegistrationInput {
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  notes?: string;
}

// ===============================================
// VOLUNTEERS
// ===============================================

export interface Volunteer {
  id: number;
  user_id: number | null;
  site_id: number | null;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  skills: string[] | null;
  interests: string[] | null;
  availability: VolunteerAvailability | null;
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  total_hours: number;
  status: 'active' | 'inactive' | 'suspended';
  background_check_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  emergency_contact: string | null;
  emergency_phone: string | null;
  joined_at: string;
  last_active_at: string | null;
  notes: string | null;
}

export interface VolunteerAvailability {
  weekdays?: { morning?: boolean; afternoon?: boolean; evening?: boolean };
  weekends?: { morning?: boolean; afternoon?: boolean; evening?: boolean };
  specific_days?: string[];
}

export interface VolunteerHours {
  id: number;
  volunteer_id: number;
  event_id: number | null;
  hours: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  category: 'event' | 'admin' | 'outreach' | 'training' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  approved_by: number | null;
  approved_at: string | null;
  logged_at: string;
}

export interface VolunteerWithStats extends Volunteer {
  approved_hours: number;
  pending_hours: number;
  events_participated: number;
}

export interface CreateVolunteerInput {
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  skills?: string[];
  interests?: string[];
  availability?: VolunteerAvailability;
  experience_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  emergency_contact?: string;
  emergency_phone?: string;
  notes?: string;
}

export interface LogVolunteerHoursInput {
  event_id?: number;
  hours: number;
  date: string;
  start_time?: string;
  end_time?: string;
  description?: string;
  category?: 'event' | 'admin' | 'outreach' | 'training' | 'other';
}

export interface VolunteerHoursSummary {
  volunteer_id: number;
  total_hours: number;
  approved_hours: number;
  pending_hours: number;
  this_month: number;
  this_year: number;
}

// ===============================================
// BLOG / CONTENT SUBMISSIONS
// ===============================================

export interface BlogSubmission {
  id: number;
  site_id: number | null;
  user_id: number | null;
  author_name: string;
  author_email: string;
  title: string;
  slug: string | null;
  content: string;
  excerpt: string | null;
  featured_image: string | null;
  category: string | null;
  tags: string[] | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'published';
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  view_count: number;
}

export interface BlogSubmissionWithAuthor extends BlogSubmission {
  reviewer_name?: string;
}

export interface CreateBlogSubmissionInput {
  title: string;
  content: string;
  excerpt?: string;
  featured_image?: string;
  category?: string;
  tags?: string[];
  author_name?: string;
  author_email?: string;
}

export interface ReviewBlogInput {
  status: 'approved' | 'rejected';
  review_notes?: string;
  publish_now?: boolean;
}

// ===============================================
// WHATSAPP
// ===============================================

export interface WhatsAppNotification {
  id: number;
  site_id: number | null;
  phone: string;
  contact_name: string | null;
  message: string;
  template_name: string | null;
  template_variables: Record<string, string> | null;
  message_type: 'text' | 'template' | 'image' | 'document' | 'location';
  media_url: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
  whatsapp_message_id: string | null;
  error_message: string | null;
  retry_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface WhatsAppContact {
  id: number;
  site_id: number | null;
  phone: string;
  name: string | null;
  email: string | null;
  opt_in: number;
  opt_in_at: string;
  opt_out_at: string | null;
  source: 'manual' | 'event_registration' | 'volunteer_signup' | 'web_signup' | 'import';
  last_message_at: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SendWhatsAppInput {
  phone: string;
  message: string;
  template_name?: string;
  template_variables?: Record<string, string>;
  message_type?: 'text' | 'template' | 'image' | 'document';
  media_url?: string;
  scheduled_at?: string;
}

export interface BulkWhatsAppInput extends SendWhatsAppInput {
  contact_ids?: number[];
  phone_numbers?: string[];
  tag?: string;
  exclude_tags?: string[];
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string; caption?: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
          conversation?: {
            id: string;
            expiration_timestamp: string;
            origin?: { type: string };
          };
          pricing?: {
            billable: boolean;
            pricing_model: string;
            category: string;
          };
        }>;
      };
      field: string;
    }>;
  }>;
}

// ===============================================
// WORKFLOWS
// ===============================================

export interface WorkflowRule {
  id: number;
  site_id: number | null;
  name: string;
  description: string | null;
  trigger_type: WorkflowTriggerType;
  conditions: WorkflowConditions | null;
  actions: WorkflowAction[];
  is_active: number;
  priority: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export type WorkflowTriggerType = 
  | 'event_created'
  | 'event_reminder'
  | 'event_registration'
  | 'event_cancelled'
  | 'volunteer_signup'
  | 'volunteer_hours_logged'
  | 'volunteer_hours_approved'
  | 'blog_submitted'
  | 'blog_approved'
  | 'blog_rejected'
  | 'user_signup'
  | 'user_action'
  | 'scheduled';

export interface WorkflowConditions {
  event_types?: string[];
  user_roles?: string[];
  time_before?: number; // minutes before event
  time_after?: number; // minutes after event
  tags?: string[];
  status?: string[];
  [key: string]: unknown;
}

export interface WorkflowAction {
  type: 'whatsapp' | 'email' | 'webhook' | 'update_status' | 'notify_admins';
  config: {
    template?: string;
    message?: string;
    email_template?: string;
    webhook_url?: string;
    webhook_method?: 'POST' | 'GET' | 'PUT';
    status?: string;
    admin_roles?: string[];
    [key: string]: unknown;
  };
}

export interface WorkflowExecution {
  id: number;
  rule_id: number;
  trigger_type: WorkflowTriggerType;
  context: Record<string, unknown>;
  actions_executed: WorkflowAction[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

// ===============================================
// API RESPONSE TYPES
// ===============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ===============================================
// ADMIN DASHBOARD TYPES
// ===============================================

export interface EventsDashboardStats {
  total_events: number;
  upcoming_events: number;
  active_registrations: number;
  total_attendees: number;
}

export interface VolunteersDashboardStats {
  total_volunteers: number;
  active_volunteers: number;
  pending_hours_approvals: number;
  total_hours_this_month: number;
}

export interface BlogDashboardStats {
  total_submissions: number;
  pending_review: number;
  published_articles: number;
  total_views: number;
}

export interface WhatsAppDashboardStats {
  total_contacts: number;
  opted_in: number;
  messages_sent: number;
  messages_delivered: number;
  delivery_rate: number;
}
