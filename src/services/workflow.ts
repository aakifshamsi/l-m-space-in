// ===============================================
// Workflow Service - Automated workflows and triggers
// ===============================================

import { D1Database } from '@cloudflare/workers-types';
import type { 
  WorkflowRule, 
  WorkflowTriggerType,
  WorkflowConditions,
  WorkflowAction,
  WorkflowExecution
} from '../types/forms-automation';
import WhatsAppService from './whatsapp';
import { createEmailService, type EmailService } from './email';

export class WorkflowService {
  private whatsappService: WhatsAppService;
  private emailService: EmailService;

  constructor(
    private db: D1Database,
    services?: {
      whatsappService?: WhatsAppService;
      emailService?: EmailService;
    }
  ) {
    this.whatsappService = services?.whatsappService || new WhatsAppService(db);
    this.emailService = services?.emailService || createEmailService({ kv: undefined });
  }

  // ===============================================
  // WORKFLOW RULES CRUD
  // ===============================================

  async createRule(
    siteId: number | null,
    input: {
      name: string;
      description?: string;
      trigger_type: WorkflowTriggerType;
      conditions?: WorkflowConditions;
      actions: WorkflowAction[];
    },
    createdBy?: number
  ): Promise<WorkflowRule> {
    const stmt = this.db.prepare(`
      INSERT INTO workflow_rules (
        site_id, name, description, trigger_type, conditions, actions, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.bind(
      siteId,
      input.name,
      input.description || null,
      input.trigger_type,
      input.conditions ? JSON.stringify(input.conditions) : null,
      JSON.stringify(input.actions),
      createdBy || null
    ).run();

    return this.getRuleById(result.meta.last_row_id as number) as Promise<WorkflowRule>;
  }

  async getRuleById(id: number): Promise<WorkflowRule | null> {
    const stmt = this.db.prepare('SELECT * FROM workflow_rules WHERE id = ?');
    const result = await stmt.bind(id).first<WorkflowRule & { conditions: string; actions: string }>();
    
    if (!result) return null;

    return {
      ...result,
      conditions: result.conditions ? JSON.parse(result.conditions) : null,
      actions: JSON.parse(result.actions)
    };
  }

  async updateRule(id: number, input: Partial<{
    name: string;
    description: string;
    trigger_type: WorkflowTriggerType;
    conditions: WorkflowConditions;
    actions: WorkflowAction[];
    is_active: number;
    priority: number;
  }>): Promise<WorkflowRule> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
    if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
    if (input.trigger_type !== undefined) { fields.push('trigger_type = ?'); values.push(input.trigger_type); }
    if (input.conditions !== undefined) { fields.push('conditions = ?'); values.push(JSON.stringify(input.conditions)); }
    if (input.actions !== undefined) { fields.push('actions = ?'); values.push(JSON.stringify(input.actions)); }
    if (input.is_active !== undefined) { fields.push('is_active = ?'); values.push(input.is_active); }
    if (input.priority !== undefined) { fields.push('priority = ?'); values.push(input.priority); }

    if (fields.length === 0) {
      return this.getRuleById(id) as Promise<WorkflowRule>;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`UPDATE workflow_rules SET ${fields.join(', ')} WHERE id = ?`);
    await stmt.bind(...values).run();

    return this.getRuleById(id) as Promise<WorkflowRule>;
  }

  async deleteRule(id: number): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM workflow_rules WHERE id = ?');
    const result = await stmt.bind(id).run();
    return result.meta.changes > 0;
  }

  async listRules(siteId?: number): Promise<WorkflowRule[]> {
    const conditions = siteId ? 'WHERE site_id = ?' : '';
    const values = siteId ? [siteId] : [];
    
    const stmt = this.db.prepare(`
      SELECT * FROM workflow_rules ${conditions} ORDER BY priority DESC, created_at DESC
    `);
    const results = await stmt.bind(...values).all<WorkflowRule & { conditions: string; actions: string }>();
    
    return results.results.map(r => ({
      ...r,
      conditions: r.conditions ? JSON.parse(r.conditions) : null,
      actions: JSON.parse(r.actions)
    }));
  }

  async getRulesForTrigger(triggerType: WorkflowTriggerType, siteId?: number): Promise<WorkflowRule[]> {
    const conditions: string[] = ['trigger_type = ?', 'is_active = 1'];
    const values: unknown[] = [triggerType];

    if (siteId) {
      conditions.push('(site_id = ? OR site_id IS NULL)');
      values.push(siteId);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM workflow_rules 
      WHERE ${conditions.join(' AND ')}
      ORDER BY priority DESC
    `);
    
    const results = await stmt.bind(...values).all<WorkflowRule & { conditions: string; actions: string }>();
    
    return results.results.map(r => ({
      ...r,
      conditions: r.conditions ? JSON.parse(r.conditions) : null,
      actions: JSON.parse(r.actions)
    }));
  }

  // ===============================================
  // TRIGGER WORKFLOWS
  // ===============================================

  async triggerWorkflow(
    triggerType: WorkflowTriggerType,
    context: Record<string, unknown>,
    siteId?: number
  ): Promise<{ triggered: number; executed: number; failed: number }> {
    const rules = await this.getRulesForTrigger(triggerType, siteId);
    
    let triggered = 0;
    let executed = 0;
    let failed = 0;

    for (const rule of rules) {
      // Check conditions
      if (rule.conditions && !this.evaluateConditions(rule.conditions, context)) {
        continue;
      }

      triggered++;

      // Create execution record
      const execStmt = this.db.prepare(`
        INSERT INTO workflow_executions (rule_id, trigger_type, context, actions_executed, status)
        VALUES (?, ?, ?, '[]', 'pending')
      `);
      const execResult = await execStmt.bind(
        rule.id,
        triggerType,
        JSON.stringify(context)
      ).run();

      const executionId = execResult.meta.last_row_id as number;

      // Execute actions
      try {
        await this.executeActions(rule.actions, context, siteId);
        
        // Update execution as completed
        const completeStmt = this.db.prepare(`
          UPDATE workflow_executions 
          SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
              actions_executed = ?
          WHERE id = ?
        `);
        await completeStmt.bind(JSON.stringify(rule.actions), executionId).run();
        
        executed++;
      } catch (error) {
        // Update execution as failed
        const errorStmt = this.db.prepare(`
          UPDATE workflow_executions 
          SET status = 'failed', completed_at = CURRENT_TIMESTAMP,
              error_message = ?
          WHERE id = ?
        `);
        await errorStmt.bind(
          error instanceof Error ? error.message : 'Unknown error',
          executionId
        ).run();
        
        failed++;
      }
    }

    return { triggered, executed, failed };
  }

  // ===============================================
  // EXECUTE ACTIONS
  // ===============================================

  private async executeActions(
    actions: WorkflowAction[],
    context: Record<string, unknown>,
    siteId?: number
  ): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'whatsapp':
          await this.executeWhatsAppAction(action, context, siteId);
          break;
        case 'email':
          await this.executeEmailAction(action, context, siteId);
          break;
        case 'webhook':
          await this.executeWebhookAction(action, context);
          break;
        case 'update_status':
          await this.executeUpdateStatusAction(action, context);
          break;
        case 'notify_admins':
          await this.executeNotifyAdminsAction(action, context, siteId);
          break;
      }
    }
  }

  private async executeWhatsAppAction(
    action: WorkflowAction,
    context: Record<string, unknown>,
    siteId?: number
  ): Promise<void> {
    const { message, template, phone, variables } = action.config;
    
    let recipientPhone = phone as string;
    if (!recipientPhone && context.phone) {
      recipientPhone = context.phone as string;
    }

    if (!recipientPhone) {
      console.warn('No phone number provided for WhatsApp action');
      return;
    }

    // Replace template variables in message
    let messageText = (message || '') as string;
    if (variables) {
      for (const [key, value] of Object.entries(variables as Record<string, string>)) {
        messageText = messageText.replace(new RegExp(`{{${key}}}`, 'g'), 
          (context[key] as string) || value);
      }
    }

    await this.whatsappService.sendNotification({
      phone: recipientPhone,
      message: messageText,
      template_name: template as string || undefined,
      template_variables: variables as Record<string, string> || undefined
    }, siteId || (context.site_id as number | undefined));
  }

  private async executeEmailAction(
    action: WorkflowAction,
    context: Record<string, unknown>,
    siteId?: number
  ): Promise<void> {
    const { to, subject, template, variables } = action.config;
    
    let recipientEmail = to as string;
    if (!recipientEmail && context.email) {
      recipientEmail = context.email as string;
    }

    if (!recipientEmail) {
      console.warn('No email provided for email action');
      return;
    }

    // Replace template variables in subject
    let emailSubject = (subject || '') as string;
    if (variables) {
      for (const [key, value] of Object.entries(variables as Record<string, string>)) {
        emailSubject = emailSubject.replace(new RegExp(`{{${key}}}`, 'g'),
          (context[key] as string) || value);
      }
    }

    await this.emailService.sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      template: template as string || undefined
    });
  }

  private async executeWebhookAction(
    action: WorkflowAction,
    context: Record<string, unknown>
  ): Promise<void> {
    const { webhook_url, webhook_method } = action.config;
    
    if (!webhook_url) {
      console.warn('No webhook URL provided');
      return;
    }

    const method = (webhook_method || 'POST') as 'POST' | 'GET' | 'PUT';

    await fetch(webhook_url as string, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: method !== 'GET' ? JSON.stringify(context) : undefined
    });
  }

  private async executeUpdateStatusAction(
    action: WorkflowAction,
    context: Record<string, unknown>
  ): Promise<void> {
    const { table, record_id, status } = action.config;
    
    if (!table || !record_id || !status) {
      console.warn('Missing parameters for update_status action');
      return;
    }

    const stmt = this.db.prepare(`UPDATE ${table} SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    await stmt.bind(status, record_id).run();
  }

  private async executeNotifyAdminsAction(
    action: WorkflowAction,
    context: Record<string, unknown>,
    siteId?: number
  ): Promise<void> {
    const { message, roles } = action.config;
    
    // Get admin users
    const conditions = ['role = ?'];
    const values: unknown[] = ['admin'];

    if (roles) {
      const roleList = (roles as string).split(',');
      conditions.push(`role IN (${roleList.map(() => '?').join(',')})`);
      values.push(...roleList);
    }

    if (siteId) {
      conditions.push('site_id = ?');
      values.push(siteId);
    }

    const stmt = this.db.prepare(`
      SELECT email FROM users WHERE ${conditions.join(' AND ')}
    `);
    const results = await stmt.bind(...values).all<{ email: string }>();

    for (const user of results.results) {
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Admin Notification',
        message: message as string
      });
    }
  }

  // ===============================================
  // CONDITION EVALUATION
  // ===============================================

  private evaluateConditions(conditions: WorkflowConditions, context: Record<string, unknown>): boolean {
    // Check event_types
    if (conditions.event_types?.length) {
      const eventType = context.event_type as string;
      if (!eventType || !conditions.event_types.includes(eventType)) {
        return false;
      }
    }

    // Check user_roles
    if (conditions.user_roles?.length) {
      const userRole = context.user_role as string;
      if (!userRole || !conditions.user_roles.includes(userRole)) {
        return false;
      }
    }

    // Check tags
    if (conditions.tags?.length) {
      const contextTags = context.tags as string[] || [];
      if (!conditions.tags.some(t => contextTags.includes(t))) {
        return false;
      }
    }

    // Check status
    if (conditions.status?.length) {
      const contextStatus = context.status as string;
      if (!contextStatus || !conditions.status.includes(contextStatus)) {
        return false;
      }
    }

    return true;
  }

  // ===============================================
  // EXECUTION LOGS
  // ===============================================

  async getExecutionLogs(options: {
    ruleId?: number;
    status?: WorkflowExecution['status'];
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ executions: WorkflowExecution[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (options.ruleId) {
      conditions.push('rule_id = ?');
      values.push(options.ruleId);
    }

    if (options.status) {
      conditions.push('status = ?');
      values.push(options.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM workflow_executions ${whereClause}`);
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const stmt = this.db.prepare(`
      SELECT * FROM workflow_executions
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<WorkflowExecution & { context: string; actions_executed: string }>();

    const executions = results.results.map(e => ({
      ...e,
      context: JSON.parse(e.context),
      actions_executed: JSON.parse(e.actions_executed)
    }));

    return {
      executions,
      total: countResult?.total || 0
    };
  }

  // ===============================================
  // DEFAULT WORKFLOW TEMPLATES
  // ===============================================

  async createDefaultWorkflows(siteId: number | null): Promise<void> {
    const defaultWorkflows = [
      // Event reminder (24 hours before)
      {
        name: 'Event Reminder - 24h Before',
        description: 'Send WhatsApp reminder to registered attendees 24 hours before event',
        trigger_type: 'event_reminder' as WorkflowTriggerType,
        conditions: { time_before: 24 * 60 } as WorkflowConditions, // 24 hours in minutes
        actions: [
          {
            type: 'whatsapp',
            config: {
              template: 'event_reminder',
              variables: {
                event_title: '{{event_title}}',
                event_date: '{{event_date}}',
                event_location: '{{event_location}}'
              }
            }
          }
        ]
      },
      // New volunteer signup welcome
      {
        name: 'New Volunteer Welcome',
        description: 'Send welcome message to new volunteers',
        trigger_type: 'volunteer_signup' as WorkflowTriggerType,
        actions: [
          {
            type: 'whatsapp',
            config: {
              message: 'Welcome to our volunteer program! 🎉 Thank you for joining us. We\'ll be in touch with opportunities to help.',
              phone: '{{phone}}'
            }
          },
          {
            type: 'email',
            config: {
              subject: 'Welcome to Our Volunteer Program!',
              template: 'volunteer-welcome',
              to: '{{email}}'
            }
          }
        ]
      },
      // Volunteer hours logged confirmation
      {
        name: 'Volunteer Hours Logged',
        description: 'Confirm volunteer hours have been logged',
        trigger_type: 'volunteer_hours_logged' as WorkflowTriggerType,
        actions: [
          {
            type: 'whatsapp',
            config: {
              message: 'Your volunteer hours have been logged: {{hours}} hours. They will be reviewed by our team.',
              phone: '{{phone}}'
            }
          }
        ]
      },
      // Volunteer hours approved
      {
        name: 'Volunteer Hours Approved',
        description: 'Notify volunteer when hours are approved',
        trigger_type: 'volunteer_hours_approved' as WorkflowTriggerType,
        actions: [
          {
            type: 'whatsapp',
            config: {
              message: 'Great news! Your {{hours}} volunteer hours have been approved. Thank you for your contribution! 🎉',
              phone: '{{phone}}'
            }
          }
        ]
      },
      // Blog submission received
      {
        name: 'Blog Submission Received',
        description: 'Confirm blog submission has been received',
        trigger_type: 'blog_submitted' as WorkflowTriggerType,
        actions: [
          {
            type: 'email',
            config: {
              subject: 'Thank you for your submission!',
              template: 'blog-submission-received',
              to: '{{author_email}}'
            }
          }
        ]
      },
      // Blog approved notification
      {
        name: 'Blog Approved',
        description: 'Notify author when their blog is approved',
        trigger_type: 'blog_approved' as WorkflowTriggerType,
        actions: [
          {
            type: 'email',
            config: {
              subject: 'Your article has been approved!',
              template: 'blog-approved',
              to: '{{author_email}}'
            }
          }
        ]
      },
      // Blog rejected notification
      {
        name: 'Blog Rejected',
        description: 'Notify author when their blog is rejected',
        trigger_type: 'blog_rejected' as WorkflowTriggerType,
        actions: [
          {
            type: 'email',
            config: {
              subject: 'Update on your article submission',
              template: 'blog-rejected',
              to: '{{author_email}}'
            }
          }
        ]
      }
    ];

    for (const workflow of defaultWorkflows) {
      await this.createRule(siteId, workflow);
    }
  }
}

export default WorkflowService;
