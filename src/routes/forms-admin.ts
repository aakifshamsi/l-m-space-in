// ===============================================
// Forms Automation Admin Routes
// Events, Volunteers, Blog, WhatsApp
// ===============================================

import { Hono } from 'hono';
import type { D1Database, Env } from '../types';
import { EventService } from '../services/event';
import { VolunteerService } from '../services/volunteer';
import { BlogService } from '../services/blog';
import { WhatsAppService } from '../services/whatsapp';
import { eventsAdminPage, eventFormModal, eventRegistrationsModal } from '../views/events-admin';
import { volunteersAdminPage, pendingHoursPanel, volunteerDetailModal } from '../views/volunteers-admin';
import { blogAdminPage, blogReviewModal, blogPreviewModal } from '../views/blog-admin';
import { whatsappAdminPage, contactsList, messageHistory, addContactModal } from '../views/whatsapp-admin';

type Variables = {
  userId?: number;
  siteId?: number;
  isAdmin?: boolean;
};

const formsAdminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware to get services
const getServices = (c: any) => {
  const db = c.env.DB as D1Database;
  
  return {
    eventService: new EventService(db),
    volunteerService: new VolunteerService(db),
    blogService: new BlogService(db),
    whatsappService: new WhatsAppService(db, {
      accessToken: c.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: c.env.WHATSAPP_PHONE_NUMBER_ID
    })
  };
};

// ===============================================
// EVENTS ADMIN
// ===============================================

formsAdminRoutes.get('/events', async (c) => {
  const { eventService } = getServices(c);
  const siteId = c.var.siteId;

  const stats = await eventService.getDashboardStats(siteId);
  const { events } = await eventService.listEvents({ siteId, pageSize: 50 });

  return c.html(eventsAdminPage(stats, events));
});

formsAdminRoutes.get('/events/new', async (c) => {
  return c.html(eventFormModal());
});

formsAdminRoutes.get('/events/:id/edit', async (c) => {
  const { eventService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  const event = await eventService.getEventById(id);
  if (!event) {
    return c.html('<div class="p-4 text-red-600">Event not found</div>');
  }

  return c.html(eventFormModal(event));
});

formsAdminRoutes.post('/events', async (c) => {
  const { eventService } = getServices(c);
  const siteId = c.var.siteId;
  const userId = c.var.userId;

  const body = await c.req.parseBody();
  
  try {
    await eventService.createEvent(siteId, {
      title: body.title as string,
      description: body.description as string,
      event_date: body.event_date as string,
      end_date: body.end_date as string,
      location: body.location as string,
      location_url: body.location_url as string,
      max_attendees: body.max_attendees ? parseInt(body.max_attendees as string) : undefined,
      registration_open: body.registration_open === '1',
      registration_deadline: body.registration_deadline as string,
      cost: body.cost ? parseFloat(body.cost as string) : undefined,
      image_url: body.image_url as string
    }, userId);

    return c.html('<div hx-refresh="true">Event created! Redirecting...</div><script>setTimeout(() => window.location.href = "/admin/events", 500)</script>');
  } catch (error) {
    return c.html(`<div class="p-4 text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown error'}</div>`);
  }
});

formsAdminRoutes.post('/events/:id', async (c) => {
  const { eventService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  const body = await c.req.parseBody();
  
  try {
    await eventService.updateEvent({
      id,
      title: body.title as string,
      description: body.description as string,
      event_date: body.event_date as string,
      end_date: body.end_date as string,
      location: body.location as string,
      location_url: body.location_url as string,
      max_attendees: body.max_attendees ? parseInt(body.max_attendees as string) : undefined,
      registration_open: body.registration_open === '1',
      registration_deadline: body.registration_deadline as string,
      cost: body.cost ? parseFloat(body.cost as string) : undefined,
      image_url: body.image_url as string
    });

    return c.html('<div hx-refresh="true">Event updated! Redirecting...</div><script>setTimeout(() => window.location.href = "/admin/events", 500)</script>');
  } catch (error) {
    return c.html(`<div class="p-4 text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown error'}</div>`);
  }
});

formsAdminRoutes.delete('/events/:id', async (c) => {
  const { eventService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  await eventService.deleteEvent(id);

  return c.html('');
});

formsAdminRoutes.get('/events/:id/registrations', async (c) => {
  const { eventService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  const event = await eventService.getEventWithStats(id);
  if (!event) {
    return c.html('<div class="p-4 text-red-600">Event not found</div>');
  }

  const { registrations } = await eventService.getEventRegistrations(id, { pageSize: 100 });

  return c.html(eventRegistrationsModal(event, registrations));
});

formsAdminRoutes.patch('/events/:id/registrations/:regId', async (c) => {
  const { eventService } = getServices(c);
  const regId = parseInt(c.req.param('regId'));

  const body = await c.req.parseBody();
  
  try {
    await eventService.updateRegistrationStatus(regId, body.status as any);
    return c.html('<div class="text-green-600">Status updated</div>');
  } catch (error) {
    return c.html(`<div class="text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown'}</div>`);
  }
});

// ===============================================
// VOLUNTEERS ADMIN
// ===============================================

formsAdminRoutes.get('/volunteers', async (c) => {
  const { volunteerService } = getServices(c);
  const siteId = c.var.siteId;

  const stats = await volunteerService.getDashboardStats(siteId);
  const { volunteers } = await volunteerService.listVolunteers({ siteId, pageSize: 50 });
  const { hours: pendingHours } = await volunteerService.getPendingHoursApprovals({ pageSize: 10 });

  return c.html(volunteersAdminPage(stats, volunteers, pendingHours));
});

formsAdminRoutes.get('/volunteers/pending', async (c) => {
  const { volunteerService } = getServices(c);

  const { hours: pendingHours } = await volunteerService.getPendingHoursApprovals({ pageSize: 50 });

  return c.html(pendingHoursPanel(pendingHours));
});

formsAdminRoutes.get('/volunteers/:id', async (c) => {
  const { volunteerService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  const volunteer = await volunteerService.getVolunteerWithStats(id);
  if (!volunteer) {
    return c.html('<div class="p-4 text-red-600">Volunteer not found</div>');
  }

  const summary = await volunteerService.getHoursSummary(id);
  const { hours: recentHours } = await volunteerService.getVolunteerHours(id, { pageSize: 5 });

  return c.html(volunteerDetailModal(volunteer, summary, recentHours));
});

formsAdminRoutes.post('/volunteers/:id/status', async (c) => {
  const { volunteerService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  const body = await c.req.parseBody();
  
  await volunteerService.updateVolunteerStatus(id, body.status as any);

  return c.html('<div hx-refresh="true">Status updated</div>');
});

formsAdminRoutes.post('/volunteers/hours/:id/approve', async (c) => {
  const { volunteerService } = getServices(c);
  const hoursId = parseInt(c.req.param('id'));
  const userId = c.var.userId;

  try {
    await volunteerService.approveHours(hoursId, userId);
    return c.html('<div hx-refresh="true" class="text-green-600">Hours approved!</div>');
  } catch (error) {
    return c.html(`<div class="text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown'}</div>`);
  }
});

formsAdminRoutes.post('/volunteers/hours/:id/reject', async (c) => {
  const { volunteerService } = getServices(c);
  const hoursId = parseInt(c.req.param('id'));
  const userId = c.var.userId;

  try {
    await volunteerService.rejectHours(hoursId, userId);
    return c.html('<div hx-refresh="true" class="text-red-600">Hours rejected</div>');
  } catch (error) {
    return c.html(`<div class="text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown'}</div>`);
  }
});

// ===============================================
// BLOG ADMIN
// ===============================================

formsAdminRoutes.get('/blog', async (c) => {
  const { blogService } = getServices(c);
  const siteId = c.var.siteId;

  const status = c.req.query('status') as any;
  const stats = await blogService.getDashboardStats(siteId);
  const { submissions } = await blogService.listSubmissions({ siteId, status, pageSize: 50 });

  return c.html(blogAdminPage(stats, submissions));
});

formsAdminRoutes.get('/blog/:id/review', async (c) => {
  const { blogService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  const submission = await blogService.getSubmissionById(id);
  if (!submission) {
    return c.html('<div class="p-4 text-red-600">Submission not found</div>');
  }

  return c.html(blogReviewModal(submission));
});

formsAdminRoutes.get('/blog/:id/preview', async (c) => {
  const { blogService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  const submission = await blogService.getSubmissionById(id);
  if (!submission) {
    return c.html('<div class="p-4 text-red-600">Submission not found</div>');
  }

  return c.html(blogPreviewModal(submission));
});

formsAdminRoutes.post('/blog/:id/approve', async (c) => {
  const { blogService } = getServices(c);
  const id = parseInt(c.req.param('id'));
  const userId = c.var.userId;

  const body = await c.req.parseBody();
  
  try {
    await blogService.reviewSubmission(id, {
      status: 'approved',
      review_notes: body.review_notes as string,
      publish_now: body.publish_now === 'true'
    }, userId);

    return c.html('<div hx-refresh="true">Article approved!</div>');
  } catch (error) {
    return c.html(`<div class="text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown'}</div>`);
  }
});

formsAdminRoutes.post('/blog/:id/reject', async (c) => {
  const { blogService } = getServices(c);
  const id = parseInt(c.req.param('id'));
  const userId = c.var.userId;

  const body = await c.req.parseBody();
  
  try {
    await blogService.reviewSubmission(id, {
      status: 'rejected',
      review_notes: body.review_notes as string
    }, userId);

    return c.html('<div hx-refresh="true">Article rejected</div>');
  } catch (error) {
    return c.html(`<div class="text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown'}</div>`);
  }
});

formsAdminRoutes.post('/blog/:id/publish', async (c) => {
  const { blogService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  try {
    await blogService.publishSubmission(id);
    return c.html('<div hx-refresh="true">Article published!</div>');
  } catch (error) {
    return c.html(`<div class="text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown'}</div>`);
  }
});

formsAdminRoutes.post('/blog/:id/unpublish', async (c) => {
  const { blogService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  try {
    await blogService.unpublishSubmission(id);
    return c.html('<div hx-refresh="true">Article unpublished</div>');
  } catch (error) {
    return c.html(`<div class="text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown'}</div>`);
  }
});

// ===============================================
// WHATSAPP ADMIN
// ===============================================

formsAdminRoutes.get('/whatsapp', async (c) => {
  const { whatsappService } = getServices(c);
  const siteId = c.var.siteId;

  const stats = await whatsappService.getDashboardStats(siteId);
  const { contacts } = await whatsappService.listContacts({ siteId, optIn: true, pageSize: 20 });
  const { notifications } = await whatsappService.listNotifications({ siteId, pageSize: 10 });

  return c.html(whatsappAdminPage(stats, contacts, notifications));
});

formsAdminRoutes.get('/whatsapp/contacts', async (c) => {
  const { whatsappService } = getServices(c);
  const siteId = c.var.siteId;

  const { contacts } = await whatsappService.listContacts({ siteId, optIn: true, pageSize: 100 });

  return c.html(contactsList(contacts));
});

formsAdminRoutes.get('/whatsapp/history', async (c) => {
  const { whatsappService } = getServices(c);
  const siteId = c.var.siteId;

  const { notifications } = await whatsappService.listNotifications({ siteId, pageSize: 50 });

  return c.html(messageHistory(notifications));
});

formsAdminRoutes.get('/whatsapp/new-contact', async (c) => {
  return c.html(addContactModal());
});

formsAdminRoutes.post('/whatsapp/contacts', async (c) => {
  const { whatsappService } = getServices(c);
  const siteId = c.var.siteId;

  const body = await c.req.parseBody();
  const tags = body.tags ? (body.tags as string).split(',').map(t => t.trim()) : undefined;

  try {
    await whatsappService.upsertContact(siteId, body.phone as string, {
      name: body.name as string,
      email: body.email as string,
      tags,
      source: 'manual'
    });

    return c.html('<div hx-refresh="true">Contact added!</div>');
  } catch (error) {
    return c.html(`<div class="text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown'}</div>`);
  }
});

formsAdminRoutes.post('/whatsapp/contacts/:id/optout', async (c) => {
  const { whatsappService } = getServices(c);
  const id = parseInt(c.req.param('id'));

  const contact = await whatsappService.getContactById(id);
  if (contact) {
    await whatsappService.optOutContact(contact.phone);
  }

  return c.html('<div hx-refresh="true">Contact removed</div>');
});

formsAdminRoutes.post('/whatsapp/send', async (c) => {
  const { whatsappService } = getServices(c);
  const siteId = c.var.siteId;

  const body = await c.req.parseBody();
  const recipientType = body.recipient_type as string;
  
  try {
    if (recipientType === 'all') {
      const result = await whatsappService.sendBulkNotifications({
        phone: '',
        message: body.message as string,
        message_type: body.message_type as any,
        tag: 'opted-in'
      }, siteId);

      return c.html(`<div class="text-green-600">Sent to ${result.sent} contacts! ${result.failed > 0 ? `(${result.failed} failed)` : ''}</div>`);
    } else if (recipientType === 'tag') {
      const result = await whatsappService.sendBulkNotifications({
        phone: '',
        message: body.message as string,
        tag: body.tag as string
      }, siteId);

      return c.html(`<div class="text-green-600">Sent to ${result.sent} contacts! ${result.failed > 0 ? `(${result.failed} failed)` : ''}</div>`);
    } else if (recipientType === 'contacts') {
      const contactIds = (body.contact_ids as string)?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (!contactIds?.length) {
        return c.html('<div class="text-red-600">Please select contacts</div>');
      }

      const result = await whatsappService.sendBulkNotifications({
        phone: '',
        message: body.message as string,
        contact_ids: contactIds
      }, siteId);

      return c.html(`<div class="text-green-600">Sent to ${result.sent} contacts! ${result.failed > 0 ? `(${result.failed} failed)` : ''}</div>`);
    } else {
      const notification = await whatsappService.sendNotification({
        phone: body.phone as string,
        message: body.message as string,
        message_type: body.message_type as any,
        scheduled_at: body.scheduled_at as string
      }, siteId);

      return c.html(`<div class="text-green-600">Message ${notification.status === 'sent' ? 'sent' : 'queued'}!</div>`);
    }
  } catch (error) {
    return c.html(`<div class="text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown'}</div>`);
  }
});

export { formsAdminRoutes };
