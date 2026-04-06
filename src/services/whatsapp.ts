// ===============================================
// WhatsApp Service - Send notifications via WhatsApp Business API
// ===============================================

import { D1Database } from '@cloudflare/workers-types';
import type { 
  WhatsAppNotification, 
  WhatsAppContact,
  SendWhatsAppInput,
  BulkWhatsAppInput,
  WhatsAppWebhookPayload,
  WhatsAppDashboardStats
} from '../types/forms-automation';

export class WhatsAppService {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;

  constructor(
    private db: D1Database,
    options: {
      accessToken?: string;
      phoneNumberId?: string;
      apiVersion?: string;
    } = {}
  ) {
    this.accessToken = options.accessToken || '';
    this.phoneNumberId = options.phoneNumberId || '';
    this.apiVersion = options.apiVersion || 'v18.0';
  }

  // ===============================================
  // WHATSAPP BUSINESS API
  // ===============================================

  async sendWhatsAppMessage(phone: string, message: string, options?: {
    templateName?: string;
    templateVariables?: Record<string, string>;
    mediaUrl?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('WhatsApp API credentials not configured');
      // Log the notification locally for development
      return this.logNotificationLocally(phone, message, options);
    }

    try {
      const headers = {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      };

      let body: Record<string, unknown>;

      if (options?.templateName) {
        // Send template message
        body = {
          messaging_product: 'whatsapp',
          to: this.formatPhoneNumber(phone),
          type: 'template',
          template: {
            name: options.templateName,
            language: { code: 'en_US' },
            components: options.templateVariables ? [
              {
                type: 'body',
                parameters: Object.entries(options.templateVariables).map(([key, value]) => ({
                  type: 'text',
                  text: value
                }))
              }
            ] : []
          }
        };
      } else if (options?.mediaUrl) {
        // Send media message
        body = {
          messaging_product: 'whatsapp',
          to: this.formatPhoneNumber(phone),
          type: 'image',
          image: {
            link: options.mediaUrl,
            caption: message
          }
        };
      } else {
        // Send text message
        body = {
          messaging_product: 'whatsapp',
          to: this.formatPhoneNumber(phone),
          type: 'text',
          text: { body: message }
        };
      }

      const response = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();

      if (data.error) {
        return {
          success: false,
          error: data.error.message || 'Failed to send message'
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id
      };
    } catch (error) {
      console.error('WhatsApp API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendNotification(input: SendWhatsAppInput, siteId?: number): Promise<WhatsAppNotification> {
    const phone = this.formatPhoneNumber(input.phone);
    
    const result = await this.sendWhatsAppMessage(
      phone,
      input.message,
      {
        templateName: input.template_name,
        templateVariables: input.template_variables,
        mediaUrl: input.media_url
      }
    );

    // Log the notification
    const stmt = this.db.prepare(`
      INSERT INTO whatsapp_notifications (
        site_id, phone, message, template_name, template_variables,
        message_type, media_url, status, whatsapp_message_id, error_message,
        scheduled_at, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const status = result.success ? 'sent' : 'failed';
    const sentAt = result.success ? new Date().toISOString() : null;

    const dbResult = await stmt.bind(
      siteId || null,
      phone,
      input.message,
      input.template_name || null,
      input.template_variables ? JSON.stringify(input.template_variables) : null,
      input.message_type || 'text',
      input.media_url || null,
      status,
      result.messageId || null,
      result.error || null,
      input.scheduled_at || null,
      sentAt
    ).run();

    // Also save/update the contact
    await this.upsertContact(siteId || null, phone);

    return this.getNotificationById(dbResult.meta.last_row_id as number) as Promise<WhatsAppNotification>;
  }

  async sendBulkNotifications(input: BulkWhatsAppInput, siteId?: number): Promise<{
    sent: number;
    failed: number;
    notifications: WhatsAppNotification[];
  }> {
    const notifications: WhatsAppNotification[] = [];
    let sent = 0;
    let failed = 0;

    // Get contacts to send to
    let phones: string[] = [];

    if (input.phone_numbers) {
      phones = input.phone_numbers.map(p => this.formatPhoneNumber(p));
    } else if (input.contact_ids) {
      const placeholders = input.contact_ids.map(() => '?').join(',');
      const stmt = this.db.prepare(
        `SELECT phone FROM whatsapp_contacts WHERE id IN (${placeholders}) AND opt_in = 1`
      );
      const results = await stmt.bind(...input.contact_ids).all<{ phone: string }>();
      phones = results.results.map(r => r.phone);
    } else if (input.tag) {
      const stmt = this.db.prepare(`
        SELECT phone FROM whatsapp_contacts 
        WHERE site_id = ? AND opt_in = 1
        AND tags LIKE ?
      `);
      const results = await stmt.bind(siteId || null, `%${input.tag}%`).all<{ phone: string }>();
      phones = results.results.map(r => r.phone);
    }

    // Send to each phone
    for (const phone of phones) {
      try {
        const notification = await this.sendNotification({
          phone,
          message: input.message,
          template_name: input.template_name,
          template_variables: input.template_variables,
          message_type: input.message_type,
          media_url: input.media_url,
          scheduled_at: input.scheduled_at
        }, siteId);

        notifications.push(notification);
        if (notification.status === 'sent') sent++;
        else failed++;
      } catch (error) {
        failed++;
      }
    }

    return { sent, failed, notifications };
  }

  // ===============================================
  // NOTIFICATION MANAGEMENT
  // ===============================================

  async getNotificationById(id: number): Promise<WhatsAppNotification | null> {
    const stmt = this.db.prepare('SELECT * FROM whatsapp_notifications WHERE id = ?');
    const result = await stmt.bind(id).first<WhatsAppNotification & { template_variables: string }>();
    
    if (!result) return null;

    return {
      ...result,
      template_variables: result.template_variables ? JSON.parse(result.template_variables) : null
    };
  }

  async updateNotificationStatus(id: number, status: WhatsAppNotification['status'], messageId?: string): Promise<WhatsAppNotification> {
    const fields = ['status = ?'];
    const values: unknown[] = [status];

    if (status === 'delivered') {
      fields.push('delivered_at = CURRENT_TIMESTAMP');
    }

    if (messageId) {
      fields.push('whatsapp_message_id = ?');
      values.push(messageId);
    }

    values.push(id);
    const stmt = this.db.prepare(`UPDATE whatsapp_notifications SET ${fields.join(', ')} WHERE id = ?`);
    await stmt.bind(...values).run();

    return this.getNotificationById(id) as Promise<WhatsAppNotification>;
  }

  async listNotifications(options: {
    siteId?: number;
    status?: WhatsAppNotification['status'];
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ notifications: WhatsAppNotification[]; total: number }> {
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM whatsapp_notifications ${whereClause}`);
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    const page = options.page || 1;
    const pageSize = options.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const stmt = this.db.prepare(`
      SELECT * FROM whatsapp_notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<WhatsAppNotification & { template_variables: string }>();

    const notifications = results.results.map(n => ({
      ...n,
      template_variables: n.template_variables ? JSON.parse(n.template_variables) : null
    }));

    return {
      notifications,
      total: countResult?.total || 0
    };
  }

  // ===============================================
  // CONTACTS MANAGEMENT
  // ===============================================

  async upsertContact(siteId: number | null, phone: string, data?: Partial<WhatsAppContact>): Promise<WhatsAppContact> {
    const formattedPhone = this.formatPhoneNumber(phone);
    
    const existingStmt = this.db.prepare(
      'SELECT * FROM whatsapp_contacts WHERE phone = ? AND site_id = ?'
    );
    const existing = await existingStmt.bind(formattedPhone, siteId).first<WhatsAppContact & { tags: string; metadata: string }>();

    if (existing) {
      // Update
      const fields: string[] = [];
      const values: unknown[] = [];

      if (data?.name) { fields.push('name = ?'); values.push(data.name); }
      if (data?.email) { fields.push('email = ?'); values.push(data.email); }
      if (data?.tags) { fields.push('tags = ?'); values.push(JSON.stringify(data.tags)); }
      if (data?.metadata) { fields.push('metadata = ?'); values.push(JSON.stringify(data.metadata)); }

      if (fields.length > 0) {
        values.push(existing.id);
        const stmt = this.db.prepare(`UPDATE whatsapp_contacts SET ${fields.join(', ')} WHERE id = ?`);
        await stmt.bind(...values).run();
      }

      return this.getContactById(existing.id) as Promise<WhatsAppContact>;
    } else {
      // Insert
      const stmt = this.db.prepare(`
        INSERT INTO whatsapp_contacts (site_id, phone, name, email, tags, metadata, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = await stmt.bind(
        siteId,
        formattedPhone,
        data?.name || null,
        data?.email || null,
        data?.tags ? JSON.stringify(data.tags) : null,
        data?.metadata ? JSON.stringify(data.metadata) : null,
        data?.source || 'manual'
      ).run();

      return this.getContactById(result.meta.last_row_id as number) as Promise<WhatsAppContact>;
    }
  }

  async getContactById(id: number): Promise<WhatsAppContact | null> {
    const stmt = this.db.prepare('SELECT * FROM whatsapp_contacts WHERE id = ?');
    const result = await stmt.bind(id).first<WhatsAppContact & { tags: string; metadata: string }>();
    
    if (!result) return null;

    return {
      ...result,
      tags: result.tags ? JSON.parse(result.tags) : null,
      metadata: result.metadata ? JSON.parse(result.metadata) : null
    };
  }

  async getContactByPhone(phone: string, siteId?: number): Promise<WhatsAppContact | null> {
    const formattedPhone = this.formatPhoneNumber(phone);
    const conditions = siteId ? 'phone = ? AND site_id = ?' : 'phone = ?';
    const values = siteId ? [formattedPhone, siteId] : [formattedPhone];
    
    const stmt = this.db.prepare(`SELECT * FROM whatsapp_contacts WHERE ${conditions}`);
    const result = await stmt.bind(...values).first<WhatsAppContact & { tags: string; metadata: string }>();
    
    if (!result) return null;

    return {
      ...result,
      tags: result.tags ? JSON.parse(result.tags) : null,
      metadata: result.metadata ? JSON.parse(result.metadata) : null
    };
  }

  async listContacts(options: {
    siteId?: number;
    optIn?: boolean;
    tag?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ contacts: WhatsAppContact[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (options.siteId) {
      conditions.push('site_id = ?');
      values.push(options.siteId);
    }

    if (options.optIn !== undefined) {
      conditions.push('opt_in = ?');
      values.push(options.optIn ? 1 : 0);
    }

    if (options.tag) {
      conditions.push('tags LIKE ?');
      values.push(`%${options.tag}%`);
    }

    if (options.search) {
      conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const searchTerm = `%${options.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM whatsapp_contacts ${whereClause}`);
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    const page = options.page || 1;
    const pageSize = options.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const stmt = this.db.prepare(`
      SELECT * FROM whatsapp_contacts
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<WhatsAppContact & { tags: string; metadata: string }>();

    const contacts = results.results.map(c => ({
      ...c,
      tags: c.tags ? JSON.parse(c.tags) : null,
      metadata: c.metadata ? JSON.parse(c.metadata) : null
    }));

    return {
      contacts,
      total: countResult?.total || 0
    };
  }

  async optOutContact(phone: string, siteId?: number): Promise<boolean> {
    const formattedPhone = this.formatPhoneNumber(phone);
    const conditions = siteId ? 'phone = ? AND site_id = ?' : 'phone = ?';
    const values = siteId ? [formattedPhone, siteId] : [formattedPhone];
    
    const stmt = this.db.prepare(`
      UPDATE whatsapp_contacts 
      SET opt_in = 0, opt_out_at = CURRENT_TIMESTAMP 
      WHERE ${conditions}
    `);
    const result = await stmt.bind(...values).run();
    return result.meta.changes > 0;
  }

  // ===============================================
  // WEBHOOK HANDLING
  // ===============================================

  async handleIncomingMessage(payload: WhatsAppWebhookPayload): Promise<void> {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Handle incoming messages
        if (value.messages) {
          for (const message of value.messages) {
            const phone = message.from;
            const contactName = value.contacts?.[0]?.profile?.name || null;

            // Save or update contact
            await this.upsertContact(null, phone, {
              name: contactName || undefined,
              source: 'web_signup'
            });

            // Update last message time
            const stmt = this.db.prepare(
              'UPDATE whatsapp_contacts SET last_message_at = CURRENT_TIMESTAMP WHERE phone = ?'
            );
            await stmt.bind(phone).run();

            // Handle different message types
            if (message.type === 'text' && message.text?.body) {
              // Check for keywords like STOP, UNSUBSCRIBE
              const body = message.text.body.toUpperCase().trim();
              if (body === 'STOP' || body === 'UNSUBSCRIBE' || body === 'STOPALL') {
                await this.optOutContact(phone);
              }
            }
          }
        }

        // Handle status updates (delivered, read, etc.)
        if (value.statuses) {
          for (const status of value.statuses) {
            const messageId = status.id;
            
            // Find and update the notification
            const updateStmt = this.db.prepare(
              "UPDATE whatsapp_notifications SET status = ? WHERE whatsapp_message_id = ?"
            );
            await updateStmt.bind(status.status, messageId).run();
          }
        }
      }
    }
  }

  // ===============================================
  // DASHBOARD STATS
  // ===============================================

  async getDashboardStats(siteId?: number): Promise<WhatsAppDashboardStats> {
    const conditions = siteId ? 'WHERE site_id = ?' : '';
    const values = siteId ? [siteId] : [];

    // Total contacts
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM whatsapp_contacts ${conditions}`);
    const totalResult = await totalStmt.bind(...values).first<{ count: number }>();

    // Opted in
    const optInStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM whatsapp_contacts ${conditions ? conditions + ' AND' : 'WHERE'} opt_in = 1`
    );
    const optInResult = await optInStmt.bind(...values).first<{ count: number }>();

    // Messages sent
    const sentStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM whatsapp_notifications ${conditions ? conditions + ' AND' : 'WHERE'} status IN ('sent', 'delivered', 'read')`
    );
    const sentResult = await sentStmt.bind(...values).first<{ count: number }>();

    // Messages delivered
    const deliveredStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM whatsapp_notifications ${conditions ? conditions + ' AND' : 'WHERE'} status IN ('delivered', 'read')`
    );
    const deliveredResult = await deliveredStmt.bind(...values).first<{ count: number }>();

    const messagesSent = sentResult?.count || 0;
    const messagesDelivered = deliveredResult?.count || 0;
    const deliveryRate = messagesSent > 0 ? (messagesDelivered / messagesSent) * 100 : 0;

    return {
      total_contacts: totalResult?.count || 0,
      opted_in: optInResult?.count || 0,
      messages_sent: messagesSent,
      messages_delivered: messagesDelivered,
      delivery_rate: Math.round(deliveryRate * 100) / 100
    };
  }

  // ===============================================
  // HELPER METHODS
  // ===============================================

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Add country code if not present (assume US/Canada if 10 digits)
    if (digits.length === 10) {
      return `1${digits}`;
    }
    
    return digits;
  }

  private async logNotificationLocally(
    phone: string, 
    message: string, 
    options?: { templateName?: string; templateVariables?: Record<string, string>; mediaUrl?: string }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log(`[DEV] WhatsApp message to ${phone}: ${message}`);
    
    return {
      success: true,
      messageId: `dev_${Date.now()}`
    };
  }
}

export default WhatsAppService;
