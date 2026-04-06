// ===============================================
// Volunteer Service - Manages volunteers and hours
// ===============================================

import { D1Database } from '@cloudflare/workers-types';
import type { 
  Volunteer, 
  VolunteerHours, 
  VolunteerWithStats,
  CreateVolunteerInput,
  LogVolunteerHoursInput,
  VolunteerHoursSummary,
  VolunteersDashboardStats
} from '../types/forms-automation';

export class VolunteerService {
  constructor(private db: D1Database) {}

  // ===============================================
  // VOLUNTEER CRUD
  // ===============================================

  async registerVolunteer(siteId: number | null, input: CreateVolunteerInput, userId?: number): Promise<Volunteer> {
    // Check if already registered
    if (userId) {
      const existingStmt = this.db.prepare('SELECT * FROM volunteers WHERE user_id = ?');
      const existing = await existingStmt.bind(userId).first<Volunteer>();
      if (existing) {
        throw new Error('User is already registered as a volunteer');
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO volunteers (
        user_id, site_id, email, phone, first_name, last_name,
        skills, interests, availability, experience_level,
        emergency_contact, emergency_phone, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.bind(
      userId || null,
      siteId,
      input.email,
      input.phone || null,
      input.first_name || null,
      input.last_name || null,
      input.skills ? JSON.stringify(input.skills) : null,
      input.interests ? JSON.stringify(input.interests) : null,
      input.availability ? JSON.stringify(input.availability) : null,
      input.experience_level || 'beginner',
      input.emergency_contact || null,
      input.emergency_phone || null,
      input.notes || null
    ).run();

    return this.getVolunteerById(result.meta.last_row_id as number) as Promise<Volunteer>;
  }

  async getVolunteerById(id: number): Promise<Volunteer | null> {
    const stmt = this.db.prepare('SELECT * FROM volunteers WHERE id = ?');
    const result = await stmt.bind(id).first<Volunteer & { skills: string; interests: string; availability: string }>();
    
    if (!result) return null;

    return {
      ...result,
      skills: result.skills ? JSON.parse(result.skills) : null,
      interests: result.interests ? JSON.parse(result.interests) : null,
      availability: result.availability ? JSON.parse(result.availability) : null
    };
  }

  async getVolunteerByUserId(userId: number): Promise<Volunteer | null> {
    const stmt = this.db.prepare('SELECT * FROM volunteers WHERE user_id = ?');
    const result = await stmt.bind(userId).first<Volunteer & { skills: string; interests: string; availability: string }>();
    
    if (!result) return null;

    return {
      ...result,
      skills: result.skills ? JSON.parse(result.skills) : null,
      interests: result.interests ? JSON.parse(result.interests) : null,
      availability: result.availability ? JSON.parse(result.availability) : null
    };
  }

  async getVolunteerWithStats(id: number): Promise<VolunteerWithStats | null> {
    const volunteer = await this.getVolunteerById(id);
    if (!volunteer) return null;

    const statsStmt = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'approved' THEN hours ELSE 0 END) as approved_hours,
        SUM(CASE WHEN status = 'pending' THEN hours ELSE 0 END) as pending_hours,
        COUNT(DISTINCT event_id) as events_participated
      FROM volunteer_hours 
      WHERE volunteer_id = ?
    `);
    const stats = await statsStmt.bind(id).first<{
      approved_hours: number;
      pending_hours: number;
      events_participated: number;
    }>();

    return {
      ...volunteer,
      approved_hours: stats?.approved_hours || 0,
      pending_hours: stats?.pending_hours || 0,
      events_participated: stats?.events_participated || 0
    };
  }

  async updateVolunteer(id: number, input: Partial<CreateVolunteerInput>): Promise<Volunteer> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.first_name !== undefined) { fields.push('first_name = ?'); values.push(input.first_name); }
    if (input.last_name !== undefined) { fields.push('last_name = ?'); values.push(input.last_name); }
    if (input.phone !== undefined) { fields.push('phone = ?'); values.push(input.phone); }
    if (input.skills !== undefined) { fields.push('skills = ?'); values.push(JSON.stringify(input.skills)); }
    if (input.interests !== undefined) { fields.push('interests = ?'); values.push(JSON.stringify(input.interests)); }
    if (input.availability !== undefined) { fields.push('availability = ?'); values.push(JSON.stringify(input.availability)); }
    if (input.experience_level !== undefined) { fields.push('experience_level = ?'); values.push(input.experience_level); }
    if (input.emergency_contact !== undefined) { fields.push('emergency_contact = ?'); values.push(input.emergency_contact); }
    if (input.emergency_phone !== undefined) { fields.push('emergency_phone = ?'); values.push(input.emergency_phone); }
    if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }

    if (fields.length === 0) {
      return this.getVolunteerById(id) as Promise<Volunteer>;
    }

    values.push(id);
    const stmt = this.db.prepare(`UPDATE volunteers SET ${fields.join(', ')} WHERE id = ?`);
    await stmt.bind(...values).run();

    return this.getVolunteerById(id) as Promise<Volunteer>;
  }

  async updateVolunteerStatus(id: number, status: Volunteer['status']): Promise<Volunteer> {
    const stmt = this.db.prepare('UPDATE volunteers SET status = ? WHERE id = ?');
    await stmt.bind(status, id).run();
    return this.getVolunteerById(id) as Promise<Volunteer>;
  }

  // ===============================================
  // VOLUNTEER LISTING
  // ===============================================

  async listVolunteers(options: {
    siteId?: number;
    status?: Volunteer['status'];
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ volunteers: VolunteerWithStats[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (options.siteId) {
      conditions.push('site_id = ?');
      values.push(options.siteId);
    }

    if (options.status) {
      conditions.push('status = ?');
      values.push(options.status);
    }

    if (options.search) {
      conditions.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)');
      const searchTerm = `%${options.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM volunteers ${whereClause}`);
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const stmt = this.db.prepare(`
      SELECT v.*,
        COALESCE((SELECT SUM(hours) FROM volunteer_hours WHERE volunteer_id = v.id AND status = 'approved'), 0) as approved_hours,
        COALESCE((SELECT SUM(hours) FROM volunteer_hours WHERE volunteer_id = v.id AND status = 'pending'), 0) as pending_hours,
        COALESCE((SELECT COUNT(DISTINCT event_id) FROM volunteer_hours WHERE volunteer_id = v.id AND event_id IS NOT NULL), 0) as events_participated
      FROM volunteers v
      ${whereClause}
      ORDER BY v.joined_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<VolunteerWithStats & { skills: string; interests: string; availability: string }>();

    const volunteers = results.results.map(v => ({
      ...v,
      skills: v.skills ? JSON.parse(v.skills) : null,
      interests: v.interests ? JSON.parse(v.interests) : null,
      availability: v.availability ? JSON.parse(v.availability) : null
    }));

    return {
      volunteers,
      total: countResult?.total || 0
    };
  }

  // ===============================================
  // VOLUNTEER HOURS
  // ===============================================

  async logVolunteerHours(volunteerId: number, input: LogVolunteerHoursInput): Promise<VolunteerHours> {
    const stmt = this.db.prepare(`
      INSERT INTO volunteer_hours (
        volunteer_id, event_id, hours, date, start_time, end_time,
        description, category, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const result = await stmt.bind(
      volunteerId,
      input.event_id || null,
      input.hours,
      input.date,
      input.start_time || null,
      input.end_time || null,
      input.description || null,
      input.category || 'other'
    ).run();

    return this.getVolunteerHoursById(result.meta.last_row_id as number) as Promise<VolunteerHours>;
  }

  async getVolunteerHoursById(id: number): Promise<VolunteerHours | null> {
    const stmt = this.db.prepare('SELECT * FROM volunteer_hours WHERE id = ?');
    const result = await stmt.bind(id).first<VolunteerHours>();
    return result || null;
  }

  async getVolunteerHours(volunteerId: number, options: {
    status?: VolunteerHours['status'];
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ hours: VolunteerHours[]; total: number }> {
    const conditions: string[] = ['volunteer_id = ?'];
    const values: unknown[] = [volunteerId];

    if (options.status) {
      conditions.push('status = ?');
      values.push(options.status);
    }

    const countStmt = this.db.prepare(
      `SELECT COUNT(*) as total FROM volunteer_hours WHERE ${conditions.join(' AND ')}`
    );
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const stmt = this.db.prepare(`
      SELECT * FROM volunteer_hours 
      WHERE ${conditions.join(' AND ')}
      ORDER BY date DESC, logged_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<VolunteerHours>();

    return {
      hours: results.results,
      total: countResult?.total || 0
    };
  }

  async getHoursSummary(volunteerId: number): Promise<VolunteerHoursSummary> {
    const stmt = this.db.prepare(`
      SELECT 
        volunteer_id,
        SUM(CASE WHEN status IN ('approved', 'pending') THEN hours ELSE 0 END) as total_hours,
        SUM(CASE WHEN status = 'approved' THEN hours ELSE 0 END) as approved_hours,
        SUM(CASE WHEN status = 'pending' THEN hours ELSE 0 END) as pending_hours,
        SUM(CASE WHEN status IN ('approved', 'pending') AND date >= date('now', 'start of month') THEN hours ELSE 0 END) as this_month,
        SUM(CASE WHEN status IN ('approved', 'pending') AND date >= date('now', 'start of year') THEN hours ELSE 0 END) as this_year
      FROM volunteer_hours 
      WHERE volunteer_id = ?
      GROUP BY volunteer_id
    `);

    const result = await stmt.bind(volunteerId).first<VolunteerHoursSummary>();
    
    return result || {
      volunteer_id: volunteerId,
      total_hours: 0,
      approved_hours: 0,
      pending_hours: 0,
      this_month: 0,
      this_year: 0
    };
  }

  async approveHours(hoursId: number, approvedBy: number): Promise<VolunteerHours> {
    const hours = await this.getVolunteerHoursById(hoursId);
    if (!hours) {
      throw new Error('Hours record not found');
    }

    // Update hours status
    const updateStmt = this.db.prepare(`
      UPDATE volunteer_hours 
      SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    await updateStmt.bind(approvedBy, hoursId).run();

    // Update volunteer total hours
    const totalStmt = this.db.prepare(`
      UPDATE volunteers 
      SET total_hours = (
        SELECT COALESCE(SUM(hours), 0) FROM volunteer_hours 
        WHERE volunteer_id = ? AND status = 'approved'
      )
      WHERE id = ?
    `);
    await totalStmt.bind(hours.volunteer_id, hours.volunteer_id).run();

    return this.getVolunteerHoursById(hoursId) as Promise<VolunteerHours>;
  }

  async rejectHours(hoursId: number, approvedBy: number): Promise<VolunteerHours> {
    const updateStmt = this.db.prepare(`
      UPDATE volunteer_hours 
      SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    await updateStmt.bind(approvedBy, hoursId).run();

    return this.getVolunteerHoursById(hoursId) as Promise<VolunteerHours>;
  }

  // ===============================================
  // PENDING HOURS APPROVAL
  // ===============================================

  async getPendingHoursApprovals(options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ hours: (VolunteerHours & { volunteer?: Volunteer })[]; total: number }> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countStmt = this.db.prepare(
      'SELECT COUNT(*) as total FROM volunteer_hours WHERE status = ?'
    );
    const countResult = await countStmt.bind('pending').first<{ total: number }>();

    const stmt = this.db.prepare(`
      SELECT vh.*, 
        v.first_name as volunteer_first_name, 
        v.last_name as volunteer_last_name,
        v.email as volunteer_email
      FROM volunteer_hours vh
      LEFT JOIN volunteers v ON vh.volunteer_id = v.id
      WHERE vh.status = 'pending'
      ORDER BY vh.logged_at ASC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(pageSize, offset).all<VolunteerHours & {
      volunteer_first_name: string | null;
      volunteer_last_name: string | null;
      volunteer_email: string | null;
    }>();

    const hours = results.results.map(r => ({
      ...r,
      volunteer: r.volunteer_email ? {
        id: r.volunteer_id,
        first_name: r.volunteer_first_name,
        last_name: r.volunteer_last_name,
        email: r.volunteer_email
      } as Volunteer : undefined
    }));

    return {
      hours,
      total: countResult?.total || 0
    };
  }

  // ===============================================
  // DASHBOARD STATS
  // ===============================================

  async getDashboardStats(siteId?: number): Promise<VolunteersDashboardStats> {
    const conditions = siteId ? 'WHERE site_id = ?' : '';
    const values = siteId ? [siteId] : [];

    // Total volunteers
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM volunteers ${conditions}`);
    const totalResult = await totalStmt.bind(...values).first<{ count: number }>();

    // Active volunteers
    const activeStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM volunteers ${conditions ? conditions + ' AND' : 'WHERE'} status = 'active'`
    );
    const activeResult = await activeStmt.bind(...values).first<{ count: number }>();

    // Pending hours approvals
    const pendingStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM volunteer_hours vh
       LEFT JOIN volunteers v ON vh.volunteer_id = v.id
       ${siteId ? 'WHERE v.site_id = ?' : ''}
       AND vh.status = 'pending'`
    );
    const pendingResult = await pendingStmt.bind(...values).first<{ count: number }>();

    // Hours this month
    const hoursStmt = this.db.prepare(`
      SELECT COALESCE(SUM(vh.hours), 0) as hours FROM volunteer_hours vh
      LEFT JOIN volunteers v ON vh.volunteer_id = v.id
      ${siteId ? 'WHERE v.site_id = ? AND' : 'WHERE'}
      vh.status IN ('approved', 'pending')
      AND vh.date >= date('now', 'start of month')
    `);
    const hoursResult = await hoursStmt.bind(...values).first<{ hours: number }>();

    return {
      total_volunteers: totalResult?.count || 0,
      active_volunteers: activeResult?.count || 0,
      pending_hours_approvals: pendingResult?.count || 0,
      total_hours_this_month: hoursResult?.hours || 0
    };
  }
}

export default VolunteerService;
