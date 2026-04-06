import type { KVNamespace } from '@cloudflare/workers-types';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  fallbackMode?: boolean;
}

export interface EmailServiceConfig {
  resendApiKey?: string;
  resendFromEmail?: string;
  siteUrl?: string;
  kv?: KVNamespace;
}

export function createEmailService(config: EmailServiceConfig) {
  const isResendConfigured = !!config.resendApiKey;
  const fromEmail = config.resendFromEmail || 'noreply@resend.dev';

  /**
   * Send an email using Resend API (primary) or fallback to logging (dev mode)
   * NEVER crashes if email is not configured - always returns gracefully
   */
  async function sendEmail(options: EmailOptions): Promise<EmailResult> {
    const { to, subject, html, text } = options;

    // Check if Resend is configured
    if (!isResendConfigured) {
      // Fallback: Log to console and optionally to KV for dev
      return await sendFallbackEmail({ to, subject, html, text });
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Resend API error (${response.status}): ${errorData}`);
        
        // Return error but don't crash - graceful degradation
        return {
          success: false,
          error: `Email service temporarily unavailable (${response.status})`,
        };
      }

      const data = await response.json() as { id?: string };
      
      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      console.error('Resend fetch error:', error);
      
      // Graceful degradation - log to fallback and return error
      await sendFallbackEmail({ to, subject, html, text });
      
      return {
        success: false,
        error: 'Email service temporarily unavailable',
        fallbackMode: true,
      };
    }
  }

  /**
   * Fallback email sending - logs to console and KV
   * Used when Resend API key is not configured or fails
   */
  async function sendFallbackEmail(options: EmailOptions): Promise<EmailResult> {
    const { to, subject, html, text } = options;
    const timestamp = new Date().toISOString();
    
    console.warn('[EMAIL FALLBACK] Email service not configured - logging email instead:');
    console.warn(`  To: ${to}`);
    console.warn(`  Subject: ${subject}`);
    console.warn(`  Preview: ${text.substring(0, 100)}...`);

    // Store in KV if available for dev/testing purposes
    if (config.kv) {
      try {
        const kvKey = `email_fallback:${timestamp}:${Date.now()}`;
        await config.kv.put(kvKey, JSON.stringify({
          to,
          subject,
          html,
          text,
          timestamp,
          status: 'fallback_mode',
        }), { expirationTtl: 86400 }); // Keep for 24 hours
      } catch (kvError) {
        console.error('KV write error (non-critical):', kvError);
      }
    }

    return {
      success: true, // Treat as success in fallback mode
      messageId: `fallback:${timestamp}`,
      error: 'Email service not configured',
      fallbackMode: true,
    };
  }

  /**
   * Check if email service is properly configured
   */
  function isConfigured(): boolean {
    return isResendConfigured;
  }

  /**
   * Send magic link email
   */
  async function sendMagicLinkEmail(
    to: string,
    magicLinkUrl: string,
    expiresInMinutes: number = 15
  ): Promise<EmailResult> {
    const siteUrl = config.siteUrl || 'https://l.m-space.in';
    const magicLinkHostname = new URL(siteUrl).hostname;
    
    const subject = `Sign in to ${magicLinkHostname}`;
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: bold; color: #10b981; }
    h1 { font-size: 20px; color: #111827; margin: 0 0 16px 0; text-align: center; }
    p { color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; }
    .button { display: inline-block; background: #10b981; color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; text-align: center; margin: 16px 0; }
    .button:hover { background: #059669; }
    .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    .link-text { font-family: monospace; font-size: 13px; word-break: break-all; color: #059669; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 16px 0; }
    .warning p { margin: 0; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">✦ m-space</div>
    </div>
    
    <h1>Your Sign-In Link</h1>
    
    <p>Click the button below to sign in to your account. This link will expire in ${expiresInMinutes} minutes.</p>
    
    <div style="text-align: center;">
      <a href="${magicLinkUrl}" class="button">Sign In</a>
    </div>
    
    <p style="font-size: 13px; color: #9ca3af;">Or copy and paste this link into your browser:</p>
    <p class="link-text">${magicLinkUrl}</p>
    
    <div class="warning">
      <p><strong>Security Notice:</strong> This link can only be used once and will expire at ${expiresInMinutes} minutes. If you didn't request this email, you can safely ignore it.</p>
    </div>
    
    <div class="footer">
      <p style="font-size: 12px; color: #9ca3af;">This email was sent by ${magicLinkHostname}</p>
    </div>
  </div>
</body>
</html>`;
    
    const text = `
Sign in to ${magicLinkHostname}

Click the link below to sign in to your account:
${magicLinkUrl}

This link will expire in ${expiresInMinutes} minutes.

Security Notice: This link can only be used once. If you didn't request this email, you can safely ignore it.
`;

    return sendEmail({ to, subject, html, text });
  }

  return {
    sendEmail,
    sendMagicLinkEmail,
    isConfigured,
  };
}

export type EmailService = ReturnType<typeof createEmailService>;
