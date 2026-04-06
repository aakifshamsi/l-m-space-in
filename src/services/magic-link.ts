import type { D1Database } from '@cloudflare/workers-types';
import { createDbHelper } from '../db';
import type { User } from '../config';

export interface MagicLinkConfig {
  jwtSecret: string;
  siteUrl: string;
  expiryMinutes?: number;
}

export interface MagicLinkResult {
  token: string;
  fullUrl: string;
}

export interface VerifyResult {
  user: User | null;
  error: string | null;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export function createMagicLinkService(db: D1Database, config: MagicLinkConfig) {
  const dbHelper = createDbHelper(db);
  const expiryMinutes = config.expiryMinutes || 15;

  /**
   * Generate a magic link for a user
   * Returns { token, fullUrl }
   */
  async function generateMagicLink(userId: number, email: string): Promise<MagicLinkResult> {
    // Create JWT payload
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expiryMinutes * 60;

    const payload = {
      user_id: userId,
      email,
      exp,
    };

    // Sign JWT using Web Crypto
    const token = await signJWT(payload, config.jwtSecret);

    // Hash the token for storage
    const tokenHash = await hashToken(token);

    // Store in database
    const id = crypto.randomUUID();
    const expiresAt = new Date(exp * 1000).toISOString();

    await dbHelper.run(
      'INSERT INTO magic_links (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [id, userId, tokenHash, expiresAt]
    );

    // Build full URL
    const fullUrl = `${config.siteUrl}/auth/magic-link/verify?token=${token}`;

    return { token, fullUrl };
  }

  /**
   * Verify a magic link token
   * Returns { user, error } or null if token is invalid
   */
  async function verifyMagicLink(token: string): Promise<VerifyResult> {
    try {
      // Hash the token to look up in DB
      const tokenHash = await hashToken(token);

      // Look up in database
      const magicLink = await dbHelper.get<{
        id: string;
        user_id: number;
        token_hash: string;
        expires_at: string;
        used_at: string | null;
      }>('SELECT * FROM magic_links WHERE token_hash = ?', [tokenHash]);

      if (!magicLink) {
        return { user: null, error: 'Invalid or already used link' };
      }

      // Check if already used
      if (magicLink.used_at) {
        return { user: null, error: 'Invalid or already used link' };
      }

      // Check expiry
      const expiresAt = new Date(magicLink.expires_at);
      if (expiresAt < new Date()) {
        return { user: null, error: 'Link expired, request a new one' };
      }

      // Verify JWT to get user info
      const jwtPayload = await verifyJWT(token, config.jwtSecret);
      if (!jwtPayload) {
        return { user: null, error: 'Invalid or already used link' };
      }

      // Mark as used
      await dbHelper.run(
        'UPDATE magic_links SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
        [magicLink.id]
      );

      // Fetch user from database
      const user = await dbHelper.get<User>(
        'SELECT * FROM users WHERE id = ?',
        [magicLink.user_id]
      );

      if (!user) {
        return { user: null, error: 'User not found' };
      }

      return { user, error: null };
    } catch (error) {
      console.error('Magic link verification error:', error);
      return { user: null, error: 'Invalid or already used link' };
    }
  }

  /**
   * Check rate limit for an email
   * Returns { allowed: boolean, retryAfter?: number }
   * 5 requests per email per hour
   */
  async function checkRateLimit(email: string): Promise<RateLimitResult> {
    const windowStart = getWindowStart();

    const rateLimit = await dbHelper.get<{
      request_count: number;
      window_start: string;
    }>(
      'SELECT * FROM magic_link_rate_limits WHERE email = ? AND window_start = ?',
      [email.toLowerCase(), windowStart]
    );

    if (!rateLimit) {
      return { allowed: true };
    }

    if (rateLimit.request_count >= 5) {
      // Calculate retry-after in seconds
      const windowEnd = new Date(rateLimit.window_start);
      windowEnd.setHours(windowEnd.getHours() + 1);
      const retryAfter = Math.ceil((windowEnd.getTime() - Date.now()) / 1000);

      return {
        allowed: false,
        retryAfter: retryAfter > 0 ? retryAfter : undefined,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a rate limit hit for an email
   */
  async function recordRateLimit(email: string): Promise<void> {
    const windowStart = getWindowStart();

    try {
      await dbHelper.run(
        `INSERT INTO magic_link_rate_limits (email, window_start, request_count) 
         VALUES (?, ?, 1)
         ON CONFLICT(email, window_start) 
         DO UPDATE SET request_count = request_count + 1`,
        [email.toLowerCase(), windowStart]
      );
    } catch (error) {
      console.error('Rate limit recording error:', error);
    }
  }

  /**
   * Get the current window start time (hourly window)
   */
  function getWindowStart(): string {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now.toISOString();
  }

  /**
   * Hash a token using SHA-256
   */
  async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Sign a JWT token
   */
  async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));

    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Use Web Crypto for HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
    const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

    return `${signingInput}.${encodedSignature}`;
  }

  /**
   * Verify a JWT token and return payload
   */
  async function verifyJWT(
    token: string,
    secret: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, encodedSignature] = parts;

      // Verify signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const signingInput = `${encodedHeader}.${encodedPayload}`;
      const signature = base64UrlDecode(encodedSignature);

      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        new Uint8Array(signature),
        encoder.encode(signingInput)
      );

      if (!isValid) return null;

      // Check expiry
      const payload = JSON.parse(base64UrlDecodeToString(encodedPayload)) as Record<string, unknown>;
      if (payload.exp && (payload.exp as number) < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Base64 URL encode
   */
  function base64UrlEncode(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Base64 URL decode to string
   */
  function base64UrlDecodeToString(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return atob(base64);
  }

  /**
   * Base64 URL decode to bytes
   */
  function base64UrlDecode(str: string): number[] {
    const decoded = base64UrlDecodeToString(str);
    return Array.from(decoded).map((c) => c.charCodeAt(0));
  }

  return {
    generateMagicLink,
    verifyMagicLink,
    checkRateLimit,
    recordRateLimit,
  };
}

export type MagicLinkService = ReturnType<typeof createMagicLinkService>;
