import type { Context, Next } from 'hono';
import type { Env, User } from '../config';
import { createDbHelper } from '../db';

export interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
}

// Get session from cookie
export async function getSession(c: Context<{ Bindings: Env }>): Promise<string | null> {
  const cookie = c.req.header('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

// Auth middleware - attaches user to context
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const sessionToken = await getSession(c);
  let user: User | null = null;

  if (sessionToken) {
    const db = createDbHelper(c.env.DB);
    const session = await db.get<{ id: string; user_id: number; expires_at: string }>(
      'SELECT id, user_id, expires_at FROM sessions WHERE id = ?',
      [sessionToken]
    );

    if (session) {
      // Check if session expired
      if (new Date(session.expires_at) > new Date()) {
        user = await db.get<User>(
          'SELECT id, email, password_hash, role, name, created_at, updated_at FROM users WHERE id = ?',
          [session.user_id]
        );
      } else {
        // Delete expired session
        await db.run('DELETE FROM sessions WHERE id = ?', [sessionToken]);
      }
    }
  }

  (c as any).set('user', user);
  (c as any).set('isAuthenticated', !!user);

  await next();
}

// Require auth middleware
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const isAuthenticated = (c as any).get('isAuthenticated') as boolean | undefined;
  
  if (!isAuthenticated) {
    return c.redirect('/login?redirect=' + encodeURIComponent(c.req.url));
  }

  await next();
}

// Require role middleware
export function requireRole(...roles: string[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> => {
    const user = (c as any).get('user') as User | null;
    
    if (!user) {
      return c.redirect('/login?redirect=' + encodeURIComponent(c.req.url));
    }

    if (!roles.includes(user.role)) {
      return c.html('<html><body><h1>403 - Forbidden</h1><p>You do not have permission to access this resource.</p></body></html>', 403);
    }

    await next();
  };
}

// Get current user
export function getCurrentUser(c: Context<{ Bindings: Env }>): User | null {
  return (c as any).get('user') as User | null;
}

// Check if user has minimum role
export function hasMinRole(user: User | null, minRole: string): boolean {
  if (!user) return false;
  
  const roleHierarchy = { owner: 3, admin: 2, editor: 1 };
  const userRole = roleHierarchy[user.role as keyof typeof roleHierarchy] || 0;
  const requiredRole = roleHierarchy[minRole as keyof typeof roleHierarchy] || 0;
  
  return userRole >= requiredRole;
}