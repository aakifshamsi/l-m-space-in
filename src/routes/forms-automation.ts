// ===============================================
// Forms Automation API Routes
// Events, Volunteers, Blog, WhatsApp
// ===============================================

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { D1Database, Env } from '../types';
import { EventService } from '../services/event';
import { VolunteerService } from '../services/volunteer';
import { BlogService } from '../services/blog';
import { WhatsAppService } from '../services/whatsapp';
import { WorkflowService } from '../services/workflow';
import { createEmailService } from '../services/email';

type Variables = {
  userId?: number;
  siteId?: number;
  isAdmin?: boolean;
};

const formsAutomationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware to get services
const getServices = (c: any) => {
  const db = c.env.DB as D1Database;
  
  const eventService = new EventService(db);
  const volunteerService = new VolunteerService(db);
  const blogService = new BlogService(db);
  const whatsappService = new WhatsAppService(db, {
    accessToken: c.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: c.env.WHATSAPP_PHONE_NUMBER_ID
  });
  const workflowService = new WorkflowService(db, {
    whatsappService,
    emailService: createEmailService({ kv: undefined })
  });

  return { eventService, volunteerService, blogService, whatsappService, workflowService };
};

// ===============================================
// EVENTS API
// ===============================================

// Create event (admin only)
formsAutomationRoutes.post('/events', async (c) => {
  const { eventService, workflowService } = getServices(c);
  const siteId = c.var.siteId;
  const userId = c.var.userId;
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const body = await c.req.json();
  
  try {
    const event = await eventService.createEvent(siteId, body, userId);
    
    // Trigger workflow
    await workflowService.triggerWorkflow('event_created', {
      event_id: event.id,
      event_title: event.title,
      event_date: event.event_date,
      site_id: siteId
    }, siteId);

    return c.json({ success: true, data: event });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create event' 
    }, 400);
  }
});

// List public events
formsAutomationRoutes.get('/events', async (c) => {
  const { eventService } = getServices(c);
  const siteId = c.var.siteId;

  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('page_size') || '20');
  const includePast = c.req.query('include_past') === 'true';

  const result = await eventService.listEvents({
    siteId,
    includePast,
    registrationOpen: true,
    page,
    pageSize
  });

  return c.json({
    success: true,
    data: result.events,
    total: result.total,
    page,
    page_size: pageSize
  });
});

// Get event details
formsAutomationRoutes.get('/events/:id', async (c) => {
  const { eventService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  const event = await eventService.getEventWithStats(id);
  
  if (!event) {
    return c.json({ success: false, error: 'Event not found' }, 404);
  }

  return c.json({ success: true, data: event });
});

// Update event (admin only)
formsAutomationRoutes.patch('/events/:id', async (c) => {
  const { eventService } = getServices(c);
  const id = parseInt(c.req.param('id'));
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const body = await c.req.json();
  
  try {
    const event = await eventService.updateEvent({ id, ...body });
    return c.json({ success: true, data: event });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update event' 
    }, 400);
  }
});

// Delete event (admin only)
formsAutomationRoutes.delete('/events/:id', async (c) => {
  const { eventService } = getServices(c);
  const id = parseInt(c.req.param('id'));
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const success = await eventService.deleteEvent(id);
  
  return c.json({ success, message: success ? 'Event deleted' : 'Event not found' });
});

// Register for event
formsAutomationRoutes.post('/events/:id/register', async (c) => {
  const { eventService, workflowService } = getServices(c);
  const eventId = parseInt(c.req.param('id'));
  const userId = c.var.userId;
  const siteId = c.var.siteId;

  const body = await c.req.json();
  
  try {
    const registration = await eventService.registerForEvent(eventId, {
      email: body.email,
      phone: body.phone,
      first_name: body.first_name,
      last_name: body.last_name,
      notes: body.notes
    }, userId);

    // Trigger workflow
    await workflowService.triggerWorkflow('event_registration', {
      event_id: eventId,
      registration_id: registration.id,
      email: body.email,
      phone: body.phone,
      site_id: siteId
    }, siteId);

    return c.json({ success: true, data: registration });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to register' 
    }, 400);
  }
});

// Cancel registration
formsAutomationRoutes.delete('/events/:id/register', async (c) => {
  const { eventService } = getServices(c);
  const eventId = parseInt(c.req.param('id'));
  const email = c.req.query('email') || c.req.header('X-User-Email');

  if (!email) {
    return c.json({ success: false, error: 'Email required' }, 400);
  }

  const success = await eventService.cancelRegistration(eventId, email);
  
  return c.json({ success, message: success ? 'Registration cancelled' : 'Registration not found' });
});

// Get event registrations (admin only)
formsAutomationRoutes.get('/events/:id/registrations', async (c) => {
  const { eventService } = getServices(c);
  const eventId = parseInt(c.req.param('id'));
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('page_size') || '50');
  const status = c.req.query('status') as any;

  const result = await eventService.getEventRegistrations(eventId, { status, page, pageSize });
  
  return c.json({
    success: true,
    data: result.registrations,
    total: result.total,
    page,
    page_size: pageSize
  });
});

// ===============================================
// VOLUNTEERS API
// ===============================================

// Register as volunteer
formsAutomationRoutes.post('/volunteers/register', async (c) => {
  const { volunteerService, whatsappService, workflowService } = getServices(c);
  const siteId = c.var.siteId;
  const userId = c.var.userId;

  const body = await c.req.json();
  
  try {
    const volunteer = await volunteerService.registerVolunteer(siteId, {
      email: body.email,
      phone: body.phone,
      first_name: body.first_name,
      last_name: body.last_name,
      skills: body.skills,
      interests: body.interests,
      availability: body.availability,
      experience_level: body.experience_level,
      emergency_contact: body.emergency_contact,
      emergency_phone: body.emergency_phone
    }, userId);

    // Add to WhatsApp contacts
    if (volunteer.phone) {
      await whatsappService.upsertContact(siteId, volunteer.phone, {
        name: `${volunteer.first_name || ''} ${volunteer.last_name || ''}`.trim() || undefined,
        email: volunteer.email,
        source: 'volunteer_signup'
      });
    }

    // Trigger workflow
    await workflowService.triggerWorkflow('volunteer_signup', {
      volunteer_id: volunteer.id,
      email: volunteer.email,
      phone: volunteer.phone,
      site_id: siteId
    }, siteId);

    return c.json({ success: true, data: volunteer });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to register volunteer' 
    }, 400);
  }
});

// Get volunteer profile
formsAutomationRoutes.get('/volunteers/profile', async (c) => {
  const { volunteerService } = getServices(c);
  const userId = c.var.userId;

  if (!userId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const volunteer = await volunteerService.getVolunteerByUserId(userId);
  
  if (!volunteer) {
    return c.json({ success: false, error: 'Volunteer profile not found' }, 404);
  }

  const withStats = await volunteerService.getVolunteerWithStats(volunteer.id);
  const summary = await volunteerService.getHoursSummary(volunteer.id);

  return c.json({ success: true, data: { ...withStats, summary } });
});

// Update volunteer profile
formsAutomationRoutes.patch('/volunteers/profile', async (c) => {
  const { volunteerService } = getServices(c);
  const userId = c.var.userId;

  if (!userId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const volunteer = await volunteerService.getVolunteerByUserId(userId);
  
  if (!volunteer) {
    return c.json({ success: false, error: 'Volunteer profile not found' }, 404);
  }

  const body = await c.req.json();
  const updated = await volunteerService.updateVolunteer(volunteer.id, body);

  return c.json({ success: true, data: updated });
});

// Log volunteer hours
formsAutomationRoutes.post('/volunteers/log-hours', async (c) => {
  const { volunteerService, workflowService } = getServices(c);
  const userId = c.var.userId;
  const siteId = c.var.siteId;

  if (!userId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const volunteer = await volunteerService.getVolunteerByUserId(userId);
  
  if (!volunteer) {
    return c.json({ success: false, error: 'Volunteer profile not found' }, 404);
  }

  const body = await c.req.json();
  
  try {
    const hours = await volunteerService.logVolunteerHours(volunteer.id, {
      event_id: body.event_id,
      hours: body.hours,
      date: body.date,
      start_time: body.start_time,
      end_time: body.end_time,
      description: body.description,
      category: body.category
    });

    // Trigger workflow
    await workflowService.triggerWorkflow('volunteer_hours_logged', {
      volunteer_id: volunteer.id,
      hours_id: hours.id,
      hours: body.hours,
      email: volunteer.email,
      phone: volunteer.phone,
      site_id: siteId
    }, siteId);

    return c.json({ success: true, data: hours });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to log hours' 
    }, 400);
  }
});

// Get hours summary
formsAutomationRoutes.get('/volunteers/hours', async (c) => {
  const { volunteerService } = getServices(c);
  const userId = c.var.userId;

  if (!userId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const volunteer = await volunteerService.getVolunteerByUserId(userId);
  
  if (!volunteer) {
    return c.json({ success: false, error: 'Volunteer profile not found' }, 404);
  }

  const summary = await volunteerService.getHoursSummary(volunteer.id);
  const result = await volunteerService.getVolunteerHours(volunteer.id, {
    page: parseInt(c.req.query('page') || '1'),
    pageSize: parseInt(c.req.query('page_size') || '20')
  });

  return c.json({
    success: true,
    data: { summary, hours: result.hours },
    total: result.total
  });
});

// List volunteers (admin only)
formsAutomationRoutes.get('/volunteers', async (c) => {
  const { volunteerService } = getServices(c);
  const siteId = c.var.siteId;
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const result = await volunteerService.listVolunteers({
    siteId,
    status: c.req.query('status') as any,
    search: c.req.query('search') || undefined,
    page: parseInt(c.req.query('page') || '1'),
    pageSize: parseInt(c.req.query('page_size') || '20')
  });

  return c.json({
    success: true,
    data: result.volunteers,
    total: result.total
  });
});

// Approve/reject volunteer hours (admin only)
formsAutomationRoutes.post('/volunteers/hours/:id/approve', async (c) => {
  const { volunteerService, workflowService } = getServices(c);
  const hoursId = parseInt(c.req.param('id'));
  const userId = c.var.userId;
  const siteId = c.var.siteId;
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const hours = await volunteerService.approveHours(hoursId, userId);

  // Get volunteer info for workflow
  const volunteer = await volunteerService.getVolunteerById(hours.volunteer_id);
  
  // Trigger workflow
  await workflowService.triggerWorkflow('volunteer_hours_approved', {
    volunteer_id: volunteer?.id,
    hours_id: hoursId,
    hours: hours.hours,
    email: volunteer?.email,
    phone: volunteer?.phone,
    site_id: siteId
  }, siteId);

  return c.json({ success: true, data: hours });
});

formsAutomationRoutes.post('/volunteers/hours/:id/reject', async (c) => {
  const { volunteerService } = getServices(c);
  const hoursId = parseInt(c.req.param('id'));
  const userId = c.var.userId;
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const hours = await volunteerService.rejectHours(hoursId, userId);
  return c.json({ success: true, data: hours });
});

// ===============================================
// BLOG API
// ===============================================

// Submit blog article
formsAutomationRoutes.post('/blog/submit', async (c) => {
  const { blogService } = getServices(c);
  const siteId = c.var.siteId;
  const userId = c.var.userId;

  const body = await c.req.json();
  
  try {
    const submission = await blogService.submitArticle(siteId, {
      title: body.title,
      content: body.content,
      excerpt: body.excerpt,
      featured_image: body.featured_image,
      category: body.category,
      tags: body.tags,
      author_name: body.author_name,
      author_email: body.author_email
    }, userId);

    return c.json({ success: true, data: submission });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to submit article' 
    }, 400);
  }
});

// List my submissions (user) or all (admin)
formsAutomationRoutes.get('/blog/submissions', async (c) => {
  const { blogService } = getServices(c);
  const siteId = c.var.siteId;
  const userId = c.var.userId;
  const isAdmin = c.var.isAdmin;

  const result = await blogService.listSubmissions({
    siteId,
    userId: !isAdmin ? userId : undefined,
    status: c.req.query('status') as any,
    search: c.req.query('search') || undefined,
    page: parseInt(c.req.query('page') || '1'),
    pageSize: parseInt(c.req.query('page_size') || '20')
  });

  return c.json({
    success: true,
    data: result.submissions,
    total: result.total
  });
});

// Approve/reject blog submission (admin)
formsAutomationRoutes.post('/blog/:id/approve', async (c) => {
  const { blogService, workflowService } = getServices(c);
  const id = parseInt(c.req.param('id'));
  const userId = c.var.userId;
  const siteId = c.var.siteId;
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const body = await c.req.json();
  
  const submission = await blogService.reviewSubmission(id, {
    status: body.status,
    review_notes: body.review_notes,
    publish_now: body.publish_now
  }, userId);

  // Trigger workflow
  await workflowService.triggerWorkflow(
    body.status === 'approved' ? 'blog_approved' : 'blog_rejected',
    {
      submission_id: id,
      title: submission.title,
      author_email: submission.author_email,
      site_id: siteId
    },
    siteId
  );

  return c.json({ success: true, data: submission });
});

// Publish blog article
formsAutomationRoutes.post('/blog/:id/publish', async (c) => {
  const { blogService } = getServices(c);
  const id = parseInt(c.req.param('id'));
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  try {
    const submission = await blogService.publishSubmission(id);
    return c.json({ success: true, data: submission });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to publish' 
    }, 400);
  }
});

// Get published articles
formsAutomationRoutes.get('/blog/published', async (c) => {
  const { blogService } = getServices(c);
  const siteId = c.var.siteId;

  const result = await blogService.getPublishedArticles({
    siteId,
    category: c.req.query('category') || undefined,
    page: parseInt(c.req.query('page') || '1'),
    pageSize: parseInt(c.req.query('page_size') || '10')
  });

  return c.json({
    success: true,
    data: result.articles,
    total: result.total
  });
});

// Get single published article
formsAutomationRoutes.get('/blog/:slug', async (c) => {
  const { blogService } = getServices(c);
  const slug = c.req.param('slug');

  const article = await blogService.getSubmissionBySlug(slug);
  
  if (!article || article.status !== 'published') {
    return c.json({ success: false, error: 'Article not found' }, 404);
  }

  // Increment view count
  await blogService.incrementViewCount(article.id);

  return c.json({ success: true, data: article });
});

// ===============================================
// WHATSAPP API
// ===============================================

// Send WhatsApp notification (admin only)
formsAutomationRoutes.post('/whatsapp/send', async (c) => {
  const { whatsappService } = getServices(c);
  const siteId = c.var.siteId;
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const body = await c.req.json();
  
  try {
    const notification = await whatsappService.sendNotification({
      phone: body.phone,
      message: body.message,
      template_name: body.template_name,
      template_variables: body.template_variables,
      message_type: body.message_type,
      media_url: body.media_url,
      scheduled_at: body.scheduled_at
    }, siteId);

    return c.json({ success: true, data: notification });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send message' 
    }, 400);
  }
});

// Send bulk WhatsApp notifications (admin only)
formsAutomationRoutes.post('/whatsapp/bulk', async (c) => {
  const { whatsappService } = getServices(c);
  const siteId = c.var.siteId;
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const body = await c.req.json();
  
  const result = await whatsappService.sendBulkNotifications({
    phone: body.message,
    message: body.message,
    template_name: body.template_name,
    template_variables: body.template_variables,
    contact_ids: body.contact_ids,
    phone_numbers: body.phone_numbers,
    tag: body.tag
  }, siteId);

  return c.json({
    success: true,
    data: {
      sent: result.sent,
      failed: result.failed,
      total: result.sent + result.failed
    }
  });
});

// List WhatsApp contacts
formsAutomationRoutes.get('/whatsapp/contacts', async (c) => {
  const { whatsappService } = getServices(c);
  const siteId = c.var.siteId;
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const result = await whatsappService.listContacts({
    siteId,
    optIn: body => c.req.query('opt_in') === 'true',
    tag: c.req.query('tag') || undefined,
    search: c.req.query('search') || undefined,
    page: parseInt(c.req.query('page') || '1'),
    pageSize: parseInt(c.req.query('page_size') || '50')
  });

  return c.json({
    success: true,
    data: result.contacts,
    total: result.total
  });
});

// Add WhatsApp contact
formsAutomationRoutes.post('/whatsapp/contacts', async (c) => {
  const { whatsappService } = getServices(c);
  const siteId = c.var.siteId;
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const body = await c.req.json();
  
  const contact = await whatsappService.upsertContact(siteId, body.phone, {
    name: body.name,
    email: body.email,
    tags: body.tags,
    source: 'manual'
  });

  return c.json({ success: true, data: contact });
});

// WhatsApp webhook
formsAutomationRoutes.post('/webhooks/whatsapp', async (c) => {
  const { whatsappService } = getServices(c);

  // Verify webhook
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === c.env.WHATSAPP_VERIFY_TOKEN) {
    return c.text(challenge as string);
  }

  // Handle incoming webhook
  try {
    const payload = await c.req.json() as any;
    await whatsappService.handleIncomingMessage(payload);
    return c.json({ success: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return c.json({ success: false, error: 'Webhook processing failed' }, 400);
  }
});

// Get WhatsApp notifications log (admin only)
formsAutomationRoutes.get('/whatsapp/notifications', async (c) => {
  const { whatsappService } = getServices(c);
  const siteId = c.var.siteId;
  const isAdmin = c.var.isAdmin;

  if (!isAdmin) {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const result = await whatsappService.listNotifications({
    siteId,
    status: c.req.query('status') as any,
    page: parseInt(c.req.query('page') || '1'),
    pageSize: parseInt(c.req.query('page_size') || '50')
  });

  return c.json({
    success: true,
    data: result.notifications,
    total: result.total
  });
});

export { formsAutomationRoutes };
