import type { D1Database } from '@cloudflare/workers-types';
import { createDbHelper } from '../db';

// Types for form integration
export interface FormIntegration {
  id: number;
  name: string;
  google_form_id: string;
  google_sheet_id: string | null;
  embed_enabled: number;
  track_submissions: number;
  created_at: string;
  updated_at: string;
}

export interface FormEvent {
  id: number;
  form_integration_id: number;
  event_type: 'view' | 'submit' | 'error';
  responder_email: string | null;
  response_data: string | null;
  ip_hash: string | null;
  created_at: string;
}

export interface FormResponse {
  timestamp?: string;
  [fieldName: string]: string | undefined;
}

// Create the Google Forms service
export function createGoogleFormsService(db: D1Database) {
  const dbHelper = createDbHelper(db);

  return {
    /**
     * Get all form integrations
     */
    async getFormIntegrations(): Promise<FormIntegration[]> {
      return dbHelper.all<FormIntegration>(
        'SELECT * FROM form_integrations ORDER BY created_at DESC'
      );
    },

    /**
     * Get a single form integration by ID
     */
    async getFormIntegration(id: number): Promise<FormIntegration | null> {
      return dbHelper.get<FormIntegration>(
        'SELECT * FROM form_integrations WHERE id = ?',
        [id]
      );
    },

    /**
     * Get form integration by Google Form ID
     */
    async getFormIntegrationByGoogleId(googleFormId: string): Promise<FormIntegration | null> {
      return dbHelper.get<FormIntegration>(
        'SELECT * FROM form_integrations WHERE google_form_id = ?',
        [googleFormId]
      );
    },

    /**
     * Create a new form integration
     */
    async createFormIntegration(
      name: string,
      googleFormId: string,
      googleSheetId?: string
    ): Promise<{ id: number }> {
      const result = await dbHelper.run(
        `INSERT INTO form_integrations (name, google_form_id, google_sheet_id, embed_enabled, track_submissions)
         VALUES (?, ?, ?, 1, 1)`,
        [name, googleFormId, googleSheetId || null]
      );
      return { id: result.lastInsertRowid! };
    },

    /**
     * Update form integration settings
     */
    async updateFormIntegration(
      id: number,
      updates: {
        name?: string;
        embed_enabled?: number;
        track_submissions?: number;
        google_sheet_id?: string;
      }
    ): Promise<boolean> {
      const setClauses: string[] = [];
      const params: unknown[] = [];

      if (updates.name !== undefined) {
        setClauses.push('name = ?');
        params.push(updates.name);
      }
      if (updates.embed_enabled !== undefined) {
        setClauses.push('embed_enabled = ?');
        params.push(updates.embed_enabled);
      }
      if (updates.track_submissions !== undefined) {
        setClauses.push('track_submissions = ?');
        params.push(updates.track_submissions);
      }
      if (updates.google_sheet_id !== undefined) {
        setClauses.push('google_sheet_id = ?');
        params.push(updates.google_sheet_id);
      }

      if (setClauses.length === 0) return false;

      setClauses.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const result = await dbHelper.run(
        `UPDATE form_integrations SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
      return result.success;
    },

    /**
     * Get embed URL for a form
     */
    getFormEmbedUrl(formId: string): string {
      return `https://docs.google.com/forms/d/e/${formId}/viewform?embedded=true`;
    },

    /**
     * Get public URL for a form
     */
    getFormPublicUrl(formId: string): string {
      return `https://docs.google.com/forms/d/e/${formId}/viewform`;
    },

    /**
     * Get pre-filled form URL with parameters
     */
    getPrefillUrl(formId: string, prefillData: Record<string, string>): string {
      const baseUrl = this.getFormPublicUrl(formId);
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(prefillData)) {
        params.append(key, value);
      }
      return `${baseUrl}?${params.toString()}`;
    },

    /**
     * Track a form event (view, submit, error)
     */
    async trackEvent(
      formIntegrationId: number,
      eventType: 'view' | 'submit' | 'error',
      options?: {
        responderEmail?: string;
        responseData?: Record<string, unknown>;
        ipHash?: string;
      }
    ): Promise<{ id: number }> {
      const result = await dbHelper.run(
        `INSERT INTO form_events (form_integration_id, event_type, responder_email, response_data, ip_hash)
         VALUES (?, ?, ?, ?, ?)`,
        [
          formIntegrationId,
          eventType,
          options?.responderEmail || null,
          options?.responseData ? JSON.stringify(options.responseData) : null,
          options?.ipHash || null,
        ]
      );
      return { id: result.lastInsertRowid! };
    },

    /**
     * Get form events with optional filtering
     */
    async getFormEvents(
      formIntegrationId: number,
      options?: {
        eventType?: string;
        limit?: number;
        offset?: number;
      }
    ): Promise<FormEvent[]> {
      const conditions: string[] = ['form_integration_id = ?'];
      const params: unknown[] = [formIntegrationId];

      if (options?.eventType) {
        conditions.push('event_type = ?');
        params.push(options.eventType);
      }

      const limit = options?.limit || 100;
      const offset = options?.offset || 0;

      return dbHelper.all<FormEvent>(
        `SELECT * FROM form_events 
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
    },

    /**
     * Get form event statistics
     */
    async getFormStats(formIntegrationId: number): Promise<{
      total_views: number;
      total_submits: number;
      total_errors: number;
      unique_responders: number;
    }> {
      const stats = await dbHelper.get<{
        total_views: number;
        total_submits: number;
        total_errors: number;
        unique_responders: number;
      }>(
        `SELECT 
           COALESCE(SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END), 0) as total_views,
           COALESCE(SUM(CASE WHEN event_type = 'submit' THEN 1 ELSE 0 END), 0) as total_submits,
           COALESCE(SUM(CASE WHEN event_type = 'error' THEN 1 ELSE 0 END), 0) as total_errors,
           COALESCE(COUNT(DISTINCT responder_email), 0) as unique_responders
         FROM form_events
         WHERE form_integration_id = ?`,
        [formIntegrationId]
      );
      return stats || { total_views: 0, total_submits: 0, total_errors: 0, unique_responders: 0 };
    },

    /**
     * Check if Google Sheets API is configured
     * Note: In Cloudflare Workers, we use a simplified approach
     * The actual Google Sheets API integration requires a backend service
     */
    isGoogleSheetsConfigured(): boolean {
      // This would be set via environment variable
      // For now, returns false as googleapis doesn't work in edge runtime
      return false;
    },

    /**
     * Get form responses from Google Sheets
     * This is a placeholder - actual implementation requires server-side code
     */
    async getFormResponses(_formId: string, _sheetId?: string): Promise<FormResponse[]> {
      if (!this.isGoogleSheetsConfigured()) {
        throw new Error('Google Sheets API not configured. Form embed only — sync disabled');
      }
      // In a real implementation, this would use googleapis to fetch from Sheets
      throw new Error('Google Sheets sync requires server-side execution');
    },

    /**
     * Hash IP address for deduplication
     */
    async hashIP(ip: string): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(ip + 'form-tracking-salt');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
  };
}

export type GoogleFormsService = ReturnType<typeof createGoogleFormsService>;
