// ===============================================
// Event Service - Manages events and registrations
// ===============================================

import { D1Database } from '@cloudflare/workers-types';
import type { 
  Event, 
  EventRegistration, 
  EventWithStats, 
  CreateEventInput, 
  UpdateEventInput,
  EventRegistrationInput,
  EventsDashboardStats
} from '../types/forms-automation';

export class EventService {
  constructor(private db: D1Database) {}

  // ===============================================
  // EVENT CRUD
  // ===============================================

  async createEvent(siteId: number | null, input: CreateEventInput, createdBy?: number): Promise<Event> {
    const stmt = this.db.prepare(`
      INSERT INTO events (
        site_id, title, description, event_date, end_date, location, location_url,
        max_attendees, registration_open, registration_deadline, cost, currency,
        image_url, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.bind(
      siteId,
      input.title,
      input.description || null,
      input.event_date || null,
      input.end_date || null,
      input.location || null,
      input.location_url || null,
      input.max_attendees || null,
      input.registration_open !== false ? 1 : 0,
      input.registration_deadline || null,
      input.cost ?? 0,
      input.currency || 'USD',
      input.image_url || null,
      createdBy || null
    ).run();

    return this.getEventById(result.meta.last_row_id as number) as Promise<Event>;
  }

  async getEventById(id: number): Promise<Event | null> {
    const stmt = this.db.prepare('SELECT * FROM events WHERE id = ?');
    const result = await stmt.bind(id).first<Event>();
    return result || null;
  }

  async getEventWithStats(id: number): Promise<EventWithStats | null> {
    const event = await this.getEventById(id);
    if (!event) return null;

    const statsStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as registration_count,
        SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) as attendee_count
      FROM event_registrations 
      WHERE event_id = ?
    `);
    const stats = await statsStmt.bind(id).first<{ registration_count: number; attendee_count: number }>();

    return {
      ...event,
      registration_count: stats?.registration_count || 0,
      attendee_count: stats?.attendee_count || 0
    };
  }

  async updateEvent(input: UpdateEventInput): Promise<Event> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) { fields.push('title = ?'); values.push(input.title); }
    if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
    if (input.event_date !== undefined) { fields.push('event_date = ?'); values.push(input.event_date); }
    if (input.end_date !== undefined) { fields.push('end_date = ?'); values.push(input.end_date); }
    if (input.location !== undefined) { fields.push('location = ?'); values.push(input.location); }
    if (input.location_url !== undefined) { fields.push('location_url = ?'); values.push(input.location_url); }
    if (input.max_attendees !== undefined) { fields.push('max_attendees = ?'); values.push(input.max_attendees); }
    if (input.registration_open !== undefined) { fields.push('registration_open = ?'); values.push(input.registration_open ? 1 : 0); }
    if (input.registration_deadline !== undefined) { fields.push('registration_deadline = ?'); values.push(input.registration_deadline); }
    if (input.cost !== undefined) { fields.push('cost = ?'); values.push(input.cost); }
    if (input.currency !== undefined) { fields.push('currency = ?'); values.push(input.currency); }
    if (input.image_url !== undefined) { fields.push('image_url = ?'); values.push(input.image_url); }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(input.id);

    const stmt = this.db.prepare(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`);
    await stmt.bind(...values).run();

    return this.getEventById(input.id) as Promise<Event>;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM events WHERE id = ?');
    const result = await stmt.bind(id).run();
    return result.meta.changes > 0;
  }

  // ===============================================
  // EVENT LISTING
  // ===============================================

  async listEvents(options: {
    siteId?: number;
    includePast?: boolean;
    registrationOpen?: boolean;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ events: EventWithStats[]; total: number }> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (options.siteId) {
      conditions.push('site_id = ?');
      values.push(options.siteId);
    }

    if (!options.includePast) {
      conditions.push("(event_date IS NULL OR event_date >= datetime('now'))");
    }

    if (options.registrationOpen !== undefined) {
      conditions.push('registration_open = ?');
      values.push(options.registrationOpen ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM events ${whereClause}`);
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    // Get events with stats
    const stmt = this.db.prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as registration_count,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND status = 'attended') as attendee_count
      FROM events e
      ${whereClause}
      ORDER BY e.event_date ASC NULLS LAST, e.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<EventWithStats>();

    return {
      events: results.results,
      total: countResult?.total || 0
    };
  }

  async getUpcomingEvents(siteId?: number, limit: number = 5): Promise<EventWithStats[]> {
    const conditions: string[] = ["event_date >= datetime('now')", 'registration_open = 1'];
    const values: unknown[] = [];

    if (siteId) {
      conditions.push('site_id = ?');
      values.push(siteId);
    }

    const stmt = this.db.prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as registration_count,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND status = 'attended') as attendee_count
      FROM events e
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.event_date ASC
      LIMIT ?
    `);

    const results = await stmt.bind(...values, limit).all<EventWithStats>();
    return results.results;
  }

  // ===============================================
  // EVENT REGISTRATIONS
  // ===============================================

  async registerForEvent(eventId: number, input: EventRegistrationInput, userId?: number): Promise<EventRegistration> {
    const event = await this.getEventById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    if (!event.registration_open) {
      throw new Error('Registration is closed for this event');
    }

    if (event.registration_deadline) {
      const deadline = new Date(event.registration_deadline);
      if (new Date() > deadline) {
        throw new Error('Registration deadline has passed');
      }
    }

    // Check if already registered
    const existingStmt = this.db.prepare(
      'SELECT * FROM event_registrations WHERE event_id = ? AND email = ? AND status != ?'
    );
    const existing = await existingStmt.bind(eventId, input.email, 'cancelled').first<EventRegistration>();
    if (existing) {
      throw new Error('Already registered for this event');
    }

    // Check capacity
    if (event.max_attendees) {
      const countStmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ? AND status IN (?, ?)'
      );
      const count = await countStmt.bind(eventId, 'registered', 'attended').first<{ count: number }>();
      if (count && count.count >= event.max_attendees) {
        // Add to waitlist instead
        input as EventRegistrationInput & { status?: 'waitlisted' };
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO event_registrations (
        event_id, user_id, email, phone, first_name, last_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.bind(
      eventId,
      userId || null,
      input.email,
      input.phone || null,
      input.first_name || null,
      input.last_name || null,
      'registered'
    ).run();

    return this.getRegistrationById(result.meta.last_row_id as number) as Promise<EventRegistration>;
  }

  async getRegistrationById(id: number): Promise<EventRegistration | null> {
    const stmt = this.db.prepare('SELECT * FROM event_registrations WHERE id = ?');
    const result = await stmt.bind(id).first<EventRegistration>();
    return result || null;
  }

  async cancelRegistration(eventId: number, email: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE event_registrations 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
      WHERE event_id = ? AND email = ?
    `);
    const result = await stmt.bind(eventId, email).run();
    return result.meta.changes > 0;
  }

  async updateRegistrationStatus(registrationId: number, status: EventRegistration['status']): Promise<EventRegistration> {
    const stmt = this.db.prepare(`
      UPDATE event_registrations 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    await stmt.bind(status, registrationId).run();
    return this.getRegistrationById(registrationId) as Promise<EventRegistration>;
  }

  async getEventRegistrations(eventId: number, options: {
    status?: EventRegistration['status'];
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ registrations: EventRegistration[]; total: number }> {
    const conditions: string[] = ['event_id = ?'];
    const values: unknown[] = [eventId];

    if (options.status) {
      conditions.push('status = ?');
      values.push(options.status);
    }

    const countStmt = this.db.prepare(
      `SELECT COUNT(*) as total FROM event_registrations WHERE ${conditions.join(' AND ')}`
    );
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    const page = options.page || 1;
    const pageSize = options.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const stmt = this.db.prepare(`
      SELECT * FROM event_registrations 
      WHERE ${conditions.join(' AND ')}
      ORDER BY registered_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<EventRegistration>();

    return {
      registrations: results.results,
      total: countResult?.total || 0
    };
  }

  async getUserRegistrations(userId: number, options: {
    status?: EventRegistration['status'];
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ registrations: (EventRegistration & { event?: Event })[]; total: number }> {
    const conditions: string[] = ['er.user_id = ?'];
    const values: unknown[] = [userId];

    if (options.status) {
      conditions.push('er.status = ?');
      values.push(options.status);
    }

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM event_registrations er
      WHERE ${conditions.join(' AND ')}
    `);
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const stmt = this.db.prepare(`
      SELECT er.*, e.title as event_title, e.event_date, e.location
      FROM event_registrations er
      LEFT JOIN events e ON er.event_id = e.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY er.registered_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<EventRegistration & { event_title?: string; event_date?: string; location?: string }>();

    const registrations = results.results.map(r => ({
      ...r,
      event: r.event_title ? {
        id: r.event_id,
        title: r.event_title,
        event_date: r.event_date,
        location: r.location
      } as Event : undefined
    }));

    return {
      registrations,
      total: countResult?.total || 0
    };
  }

  // ===============================================
  // DASHBOARD STATS
  // ===============================================

  async getDashboardStats(siteId?: number): Promise<EventsDashboardStats> {
    const conditions = siteId ? 'WHERE site_id = ?' : '';
    const values = siteId ? [siteId] : [];

    // Total events
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM events ${conditions}`);
    const totalResult = await totalStmt.bind(...values).first<{ count: number }>();

    // Upcoming events
    const upcomingStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM events ${conditions ? conditions + ' AND' : 'WHERE'} 
      event_date >= datetime('now')
    `);
    const upcomingResult = await upcomingStmt.bind(...values).first<{ count: number }>();

    // Active registrations
    const registrationsStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM event_registrations er
      LEFT JOIN events e ON er.event_id = e.id
      ${siteId ? 'WHERE e.site_id = ?' : ''}
      AND er.status IN ('registered', 'attended')
    `);
    const registrationsResult = await registrationsStmt.bind(...values).first<{ count: number }>();

    // Total attendees (attended status)
    const attendeesStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM event_registrations er
      LEFT JOIN events e ON er.event_id = e.id
      ${siteId ? 'WHERE e.site_id = ?' : ''}
      AND er.status = 'attended'
    `);
    const attendeesResult = await attendeesStmt.bind(...values).first<{ count: number }>();

    return {
      total_events: totalResult?.count || 0,
      upcoming_events: upcomingResult?.count || 0,
      active_registrations: registrationsResult?.count || 0,
      total_attendees: attendeesResult?.count || 0
    };
  }

  // ===============================================
  // EVENT REMINDERS
  // ===============================================

  async getEventsNeedingReminders(hoursBeforeEvent: number = 24): Promise<Event[]> {
    const stmt = this.db.prepare(`
      SELECT e.* FROM events e
      LEFT JOIN event_registrations er ON e.id = er.event_id
      WHERE e.event_date BETWEEN 
        datetime('now', '+${hoursBeforeEvent - 1} hours') AND 
        datetime('now', '+${hoursBeforeEvent + 1} hours')
      AND e.registration_open = 1
      AND er.status = 'registered'
      GROUP BY e.id
    `);
    const results = await stmt.all<Event>();
    return results.results;
  }

  async getEventAttendeesForReminder(eventId: number): Promise<EventRegistration[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM event_registrations 
      WHERE event_id = ? AND status IN ('registered', 'attended')
    `);
    const results = await stmt.bind(eventId).all<EventRegistration>();
    return results.results;
  }
}

export default EventService;
