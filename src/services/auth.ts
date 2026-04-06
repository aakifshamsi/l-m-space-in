import type { Env, User, Session } from '../config';
import { createDbHelper, generateRandomString } from '../db';

const SESSION_EXPIRY_DAYS = 7;

export function createAuthService(env: Env['DB']) {
  const db = createDbHelper(env);

  // Login user
  async function login(email: string, password: string): Promise<User | null> {
    // Simple password check (in production, use bcrypt)
    // For now, we'll check against hashed password
    const user = await db.get<User>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!user) return null;

    const passwordHash = await hashPassword(password);
    if (user.password_hash !== passwordHash) {
      return null;
    }

    return user;
  }

  // Create session
  async function createSession(userId: number): Promise<string> {
    const token = generateRandomString(64);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    await db.run(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
      [token, userId, expiresAt.toISOString()]
    );

    return token;
  }

  // Delete session
  async function removeSession(token: string): Promise<void> {
    await db.run('DELETE FROM sessions WHERE id = ?', [token]);
  }

  // Get user by session
  async function getUserBySession(token: string): Promise<User | null> {
    const session = await db.get<Session>(
      'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")',
      [token]
    );

    if (!session) return null;

    const user = await db.get<User>(
      'SELECT * FROM users WHERE id = ?',
      [session.user_id]
    );

    return user;
  }

  // Register new user
  async function register(email: string, password: string, name: string, role: string = 'editor'): Promise<User> {
    const existingUser = await db.get<User>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      throw new Error('User already exists');
    }

    const passwordHash = await hashPassword(password);

    const result = await db.run(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, passwordHash, name, role]
    );

    const user = await db.get<User>(
      'SELECT * FROM users WHERE id = ?',
      [result.lastInsertRowid]
    );

    if (!user) throw new Error('Failed to create user');

    return user;
  }

  // Update user
  async function updateUser(id: number, data: { name?: string; email?: string; role?: string }): Promise<User> {
    const existing = await db.get<User>('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) throw new Error('User not found');

    await db.run(
      'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), role = COALESCE(?, role), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [data.name || null, data.email || null, data.role || null, id]
    );

    const updated = await db.get<User>('SELECT * FROM users WHERE id = ?', [id]);
    if (!updated) throw new Error('Failed to update user');

    return updated;
  }

  // Delete user
  async function removeUser(id: number): Promise<void> {
    await db.run('DELETE FROM sessions WHERE user_id = ?', [id]);
    await db.run('DELETE FROM users WHERE id = ?', [id]);
  }

  // Get all users
  async function getUsers(): Promise<User[]> {
    return db.all<User>('SELECT * FROM users ORDER BY created_at DESC');
  }

  // Get user by ID
  async function getUserById(id: number): Promise<User | null> {
    return db.get<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  // Change password
  async function changePassword(userId: number, newPassword: string): Promise<void> {
    const passwordHash = await hashPassword(newPassword);
    await db.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, userId]
    );
  }

  return {
    login,
    createSession,
    deleteSession: removeSession,
    getUserBySession,
    register,
    updateUser,
    deleteUser: removeUser,
    getUsers,
    getUserById,
    changePassword,
  };
}

// Simple hash function
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'l-m-space-in-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export type AuthService = ReturnType<typeof createAuthService>;