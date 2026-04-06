import type { D1Database } from '@cloudflare/workers-types';
import { createDbHelper } from '../db';
import type { FormIntegration } from './google-forms';

// Types for protected links
export interface ProtectedLink {
  id: number;
  form_integration_id: number;
  purpose: string;
  magic_token: string;
  prefill_data: string | null;
  expires_at: string | null;
  used_count: number;
  max_uses: number | null;
  created_by: number;
  created_at: string;
}

export interface ProtectedLinkData {
  formId: string;
  formName: string;
  purpose: string;
  prefillData: Record<string, string> | null;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  createdAt: Date;
}

export interface CreateProtectedLinkOptions {
  formIntegrationId: number;
  purpose: string;
  prefillData?: Record<string, string>;
  expiresIn?: number; // hours
  maxUses?: number;
  userId: number;
  siteUrl: string;
}

// Generate a secure random token
function generateToken(length: number = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues)
    .map(b => chars[b % chars.length])
    .join('');
}

// Create HMAC-based token (simpler than JWT for edge runtime)
async function createToken(data: {
  linkId: number;
  formId: string;
  expiresAt: number;
  secret: string;
}): Promise<string> {
  const payload = JSON.stringify({
    id: data.linkId,
    fid: data.formId,
    exp: data.expiresAt,
  });
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(data.secret);
  const messageData = encoder.encode(payload + data.secret);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  // Combine payload and signature (simple format)
  return btoa(payload) + '.' + signatureBase64.replace(/[+/=]/g, (c) => ({
    '+': '-', '/': '_', '=': ''
  } as Record<string, string>)[c] || c);
}

// Verify HMAC-based token
async function verifyToken(
  token: string,
  secret: string
): Promise<{ valid: boolean; linkId?: number; formId?: string; exp?: number }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false };
    }

    const [payloadBase64, signatureBase64] = parts;
    const payload = JSON.parse(atob(payloadBase64));
    
    // Recreate and verify signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payloadBase64 + secret);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSignature = await crypto.subtle.sign('HMAC', key, messageData);
    const expectedSignatureBase64 = btoa(String.fromCharCode(...new Uint8Array(expectedSignature)))
      .replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' } as Record<string, string>)[c] || c);
    
    if (signatureBase64 !== expectedSignatureBase64) {
      return { valid: false };
    }

    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false };
    }

    return {
      valid: true,
      linkId: payload.id,
      formId: payload.fid,
      exp: payload.exp,
    };
  } catch {
    return { valid: false };
  }
}

// Create the Protected Link service
export function createProtectedLinkService(db: D1Database, jwtSecret: string = 'default-secret') {
  const dbHelper = createDbHelper(db);

  return {
    /**
     * Create a new protected link for a form
     */
    async createProtectedLink(options: CreateProtectedLinkOptions): Promise<{
      id: number;
      token: string;
      url: string;
      expiresAt: Date | null;
    }> {
      const token = generateToken();
      const expiresAt = options.expiresIn
        ? new Date(Date.now() + options.expiresIn * 60 * 60 * 1000)
        : null;

      // Insert into database
      const result = await dbHelper.run(
        `INSERT INTO protected_links 
         (form_integration_id, purpose, magic_token, prefill_data, expires_at, max_uses, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          options.formIntegrationId,
          options.purpose,
          token,
          options.prefillData ? JSON.stringify(options.prefillData) : null,
          expiresAt?.toISOString() || null,
          options.maxUses || null,
          options.userId,
        ]
      );

      const linkId = result.lastInsertRowid!;

      // Create a signed token for the URL
      const signedToken = await createToken({
        linkId,
        formId: options.formIntegrationId.toString(),
        expiresAt: expiresAt?.getTime() || 0,
        secret: jwtSecret,
      });

      // Full magic URL
      const url = `${options.siteUrl}/forms/protected/${signedToken}`;

      return {
        id: linkId,
        token: signedToken,
        url,
        expiresAt,
      };
    },

    /**
     * Verify a protected link token
     */
    async verifyProtectedLink(token: string): Promise<{
      valid: boolean;
      error?: 'expired' | 'limit_reached' | 'not_found' | 'invalid';
      link?: ProtectedLink;
      form?: FormIntegration;
      prefillData?: Record<string, string>;
    }> {
      // Verify the signed token
      const verification = await verifyToken(token, jwtSecret);
      
      if (!verification.valid || !verification.linkId) {
        return { valid: false, error: 'invalid' };
      }

      // Get link from database
      const link = await dbHelper.get<ProtectedLink>(
        'SELECT * FROM protected_links WHERE id = ?',
        [verification.linkId]
      );

      if (!link) {
        return { valid: false, error: 'not_found' };
      }

      // Check expiration
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return { valid: false, error: 'expired', link };
      }

      // Check max uses
      if (link.max_uses && link.used_count >= link.max_uses) {
        return { valid: false, error: 'limit_reached', link };
      }

      // Get associated form
      const form = await dbHelper.get<FormIntegration>(
        'SELECT * FROM form_integrations WHERE id = ?',
        [link.form_integration_id]
      );

      if (!form) {
        return { valid: false, error: 'not_found', link };
      }

      // Parse prefill data
      let prefillData: Record<string, string> | undefined;
      if (link.prefill_data) {
        try {
          prefillData = JSON.parse(link.prefill_data);
        } catch {
          // Ignore parse errors
        }
      }

      return {
        valid: true,
        link,
        form,
        prefillData,
      };
    },

    /**
     * Record usage of a protected link
     */
    async recordUsage(
      token: string,
      _options?: {
        responderEmail?: string;
        ipHash?: string;
      }
    ): Promise<{ success: boolean; usedCount: number }> {
      const verification = await verifyToken(token, jwtSecret);
      
      if (!verification.valid || !verification.linkId) {
        return { success: false, usedCount: 0 };
      }

      const result = await dbHelper.run(
        'UPDATE protected_links SET used_count = used_count + 1 WHERE id = ?',
        [verification.linkId]
      );

      // Get updated count
      const link = await dbHelper.get<ProtectedLink>(
        'SELECT used_count FROM protected_links WHERE id = ?',
        [verification.linkId]
      );

      return {
        success: result.success,
        usedCount: link?.used_count || 0,
      };
    },

    /**
     * Get all protected links for a form
     */
    async getProtectedLinks(formIntegrationId: number): Promise<ProtectedLink[]> {
      return dbHelper.all<ProtectedLink>(
        'SELECT * FROM protected_links WHERE form_integration_id = ? ORDER BY created_at DESC',
        [formIntegrationId]
      );
    },

    /**
     * Get protected link by ID
     */
    async getProtectedLink(id: number): Promise<ProtectedLink | null> {
      return dbHelper.get<ProtectedLink>(
        'SELECT * FROM protected_links WHERE id = ?',
        [id]
      );
    },

    /**
     * Delete a protected link
     */
    async deleteProtectedLink(id: number): Promise<boolean> {
      const result = await dbHelper.run(
        'DELETE FROM protected_links WHERE id = ?',
        [id]
      );
      return result.success && (result.changes || 0) > 0;
    },

    /**
     * Get protected link statistics
     */
    async getProtectedLinkStats(formIntegrationId: number): Promise<{
      total_links: number;
      active_links: number;
      total_uses: number;
    }> {
      const stats = await dbHelper.get<{
        total_links: number;
        active_links: number;
        total_uses: number;
      }>(
        `SELECT 
           COUNT(*) as total_links,
           COALESCE(SUM(CASE WHEN expires_at IS NULL OR expires_at > datetime('now') THEN 1 ELSE 0 END), 0) as active_links,
           COALESCE(SUM(used_count), 0) as total_uses
         FROM protected_links
         WHERE form_integration_id = ?`,
        [formIntegrationId]
      );
      return stats || { total_links: 0, active_links: 0, total_uses: 0 };
    },

    /**
     * Build prefill URL for a form
     */
    buildPrefillUrl(formId: string, prefillData: Record<string, string>): string {
      const baseUrl = `https://docs.google.com/forms/d/e/${formId}/viewform`;
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(prefillData)) {
        params.append(key, value);
      }
      return `${baseUrl}?${params.toString()}`;
    },
  };
}

export type ProtectedLinkService = ReturnType<typeof createProtectedLinkService>;
