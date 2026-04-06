import type { Env } from '../config';

// Type-safe database query helper
export function createDbHelper(env: Env['DB']) {
  return {
    // Get a single row
    async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const result = await env.prepare(sql).bind(...params).first<T>();
      return result || null;
    },

    // Get all rows
    async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await env.prepare(sql).bind(...params).all<T>();
      return result.results || [];
    },

    // Run a query (INSERT, UPDATE, DELETE)
    async run(sql: string, params: unknown[] = []): Promise<{ success: boolean; lastInsertRowid?: number; changes?: number }> {
      const result = await env.prepare(sql).bind(...params).run();
      return {
        success: result.success,
        lastInsertRowid: result.meta?.last_row_id,
        changes: result.meta?.changes,
      };
    },

    // Execute raw SQL (for migrations)
    async exec(sql: string): Promise<void> {
      await env.exec(sql);
    },
  };
}

export type DbHelper = ReturnType<typeof createDbHelper>;

// Helper to parse datetime strings
export function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

// Helper to format date for display
export function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Helper to format datetime
export function formatDateTime(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Generate random slug
export function generateSlug(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

// Generate random string (alias for generateSlug for compatibility)
export function generateRandomString(length: number = 8): string {
  return generateSlug(length);
}

// Validate URL
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Simple hash function for passwords (in production, use bcrypt)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'l-m-space-in-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computedHash = await hashPassword(password);
  return computedHash === hash;
}

// Note: For production, you should use a proper password hashing library
// This simple SHA-256 is for demonstration purposes only