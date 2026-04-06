import { Hono } from 'hono';
import type { Env } from '../config';
import { createDbHelper, generateRandomString, hashPassword } from '../db';
import { authMiddleware } from '../middleware/auth';
import { renderMasterHome } from '../views/master/home';
import { renderProfilePage, renderProfileNotFound } from '../views/master/profile';
import { renderJoinPage, renderJoinSuccess } from '../views/master/join';

export const masterRoutes = new Hono<{ Bindings: Env }>();

// Home
masterRoutes.get('/', (c) => {
  return c.html(renderMasterHome());
});

// Public user profile
masterRoutes.get('/u/:handle', authMiddleware, async (c) => {
  const handle = (c.req.param('handle') ?? '').toLowerCase();
  const db = createDbHelper(c.env.DB);

  const profile = await db.get<{
    handle: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    tier: string;
    is_public: number;
    created_at: string;
    user_id: string;
  }>(
    'SELECT up.*, u.created_at FROM user_profiles up JOIN users u ON u.id = up.user_id WHERE up.handle = ?',
    [handle]
  );

  if (!profile || (!profile.is_public)) {
    return c.html(renderProfileNotFound(), 404);
  }

  const linkCount = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM links WHERE created_by = ? AND is_active = 1 AND is_trashed = 0',
    [profile.user_id]
  );

  const currentUser = (c as any).get('user');

  return c.html(renderProfilePage({
    handle: profile.handle,
    display_name: profile.display_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    tier: profile.tier,
    joined: profile.created_at,
    link_count: linkCount?.count ?? 0,
  }, currentUser));
});

// Invite registration — GET
masterRoutes.get('/join', (c) => {
  const code = c.req.query('code') || '';
  return c.html(renderJoinPage({ code }));
});

// Invite registration — POST
masterRoutes.post('/join', async (c) => {
  const db = createDbHelper(c.env.DB);
  const body = await c.req.parseBody();
  const code = String(body.code || '').trim().toUpperCase();
  const email = String(body.email || '').trim().toLowerCase();
  const displayName = String(body.display_name || '').trim();
  const handle = String(body.handle || '').trim().toLowerCase();

  // Validate handle format
  if (!/^[a-z0-9_-]{3,30}$/.test(handle)) {
    return c.html(renderJoinPage({ error: 'Invalid handle format.', code }), 400);
  }

  // Verify invite code
  const invite = await db.get<{
    id: number;
    code: string;
    use_count: number;
    max_uses: number;
    expires_at: string;
  }>('SELECT * FROM invite_codes WHERE code = ?', [code]);

  if (!invite) {
    return c.html(renderJoinPage({ error: 'Invalid invite code.', code }), 400);
  }
  if (invite.use_count >= invite.max_uses) {
    return c.html(renderJoinPage({ error: 'This invite code has already been used.', code }), 400);
  }
  if (new Date(invite.expires_at) < new Date()) {
    return c.html(renderJoinPage({ error: 'This invite code has expired.', code }), 400);
  }

  // Check for existing user/handle
  const existingUser = await db.get<{ id: string }>('SELECT id FROM users WHERE email = ?', [email]);
  if (existingUser) {
    return c.html(renderJoinPage({ error: 'An account with this email already exists.', code }), 400);
  }
  const existingHandle = await db.get<{ id: number }>('SELECT id FROM user_profiles WHERE handle = ?', [handle]);
  if (existingHandle) {
    return c.html(renderJoinPage({ error: 'This handle is already taken.', code }), 400);
  }

  // Create user
  const userId = generateRandomString(16);
  const tempPassword = generateRandomString(24);
  const passwordHash = await hashPassword(tempPassword);

  await db.run(
    'INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
    [userId, email, passwordHash, 'editor', displayName]
  );

  // Create profile
  await db.run(
    'INSERT INTO user_profiles (user_id, handle, display_name, tier) VALUES (?, ?, ?, ?)',
    [userId, handle, displayName, 'free']
  );

  // Update invite code usage
  await db.run(
    'UPDATE invite_codes SET use_count = use_count + 1, used_by = ?, used_at = datetime("now") WHERE id = ?',
    [userId, invite.id]
  );

  // Send magic link so they can sign in (no password to remember)
  // The magic link service is accessed via the main app, so we redirect to login with a message
  return c.html(renderJoinSuccess(handle));
});
