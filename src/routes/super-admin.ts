// Super Admin Routes - Master Control Panel for all sites
// Accessible at m-space.in/admin/super/*

import { Hono } from 'hono';
import type { Env } from '../config';
import { createDbHelper } from '../db';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { checkOllamaStatus } from '../services/ai';
import { renderSuperAdminDashboard } from '../views/master/super-admin';

export const superAdminRoutes = new Hono<{ Bindings: Env }>();

// Apply auth and owner role check to all super admin routes
superAdminRoutes.use('*', requireAuth);
superAdminRoutes.use('*', async (c, next) => {
  const user = await getCurrentUser(c);
  if (!user || user.role !== 'owner') {
    return c.json({ error: 'Super admin access required' }, 403);
  }
  await next();
  return;
});

// ==========================================
// Dashboard & Status
// ==========================================

// System overview — HTML dashboard using real DB data
superAdminRoutes.get('/dashboard', async (c) => {
  const db = createDbHelper(c.env.DB);
  const hostname = c.req.header('host') || '';

  if (!hostname.includes('m-space.in') && !hostname.includes('localhost')) {
    return c.json({ error: 'Access denied from this domain' }, 403);
  }

  const currentUser = await getCurrentUser(c);

  const [linkCount, userCount, clickCount, activeLinks] = await Promise.all([
    db.get<{ count: number }>('SELECT COUNT(*) as count FROM links'),
    db.get<{ count: number }>('SELECT COUNT(*) as count FROM users'),
    db.get<{ count: number }>('SELECT COUNT(*) as count FROM clicks'),
    db.get<{ count: number }>('SELECT COUNT(*) as count FROM links WHERE is_active = 1'),
  ]);

  const sites = await db.all<{
    id: number; name: string; subdomain: string; domain: string;
    status: string; plan: string; max_links: number; enable_ads: number;
  }>('SELECT id, name, subdomain, domain, status, plan, max_links, enable_ads FROM sites ORDER BY id');

  const activity = await db.all<{
    action: string; details: string | null; created_at: string;
  }>('SELECT action, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 10');

  return c.html(renderSuperAdminDashboard(
    {
      totalLinks: linkCount?.count ?? 0,
      activeLinks: activeLinks?.count ?? 0,
      totalUsers: userCount?.count ?? 0,
      totalClicks: clickCount?.count ?? 0,
    },
    sites,
    activity,
    { email: currentUser!.email, role: currentUser!.role }
  ));
});

// ==========================================
// Site Management
// ==========================================

// List all sites
superAdminRoutes.get('/sites', async (c) => {
  const db = createDbHelper(c.env.DB);
  
  const sites = [
    {
      id: 1,
      name: 'Muslim Space Link',
      subdomain: 'l',
      domain: 'm-space.in',
      type: 'main',
      status: 'active',
      features: ['all'],
      users: await db.all('SELECT COUNT(*) as count FROM users'),
    },
    {
      id: 2,
      name: 'Edgy Links',
      subdomain: 'edgy',
      domain: 'frii.site',
      type: 'edgy',
      status: 'dns_pending',
      features: ['limited', 'more_ads'],
      users: await db.all("SELECT COUNT(*) as count FROM users WHERE email LIKE '%@edgy%'"),
    },
  ];
  
  return c.json({ success: true, sites });
});

// DNS Status Checker
superAdminRoutes.get('/dns-status', async (c) => {
  const dnsTargets = [
    { name: 'l.m-space.in', expected: 'Cloudflare Worker', type: 'cname' },
    { name: 'm-space.in', expected: 'Cloudflare Worker', type: 'cname' },
    { name: 'edgy.frii.site', expected: 'l.m-space.in', type: 'cname', status: 'pending_user_action' },
    { name: 'www.frii.site', expected: 'l.m-space.in', type: 'cname', status: 'pending_user_action' },
  ];
  
  return c.json({
    success: true,
    dnsStatus: dnsTargets,
    instructions: {
      frii_site: {
        required: true,
        records: [
          { type: 'CNAME', name: 'edgy', value: 'l.m-space.in' },
          { type: 'CNAME', name: 'www', value: 'l.m-space.in' },
        ],
        registrar: 'User must add these at frii.site registrar',
      },
    },
  });
});

// ==========================================
// User Management (Cross-site)
// ==========================================

// List all users across sites
superAdminRoutes.get('/users', async (c) => {
  const db = createDbHelper(c.env.DB);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;
  
  const users = await db.all(
    `SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  
  const [{ total }] = await db.all<{ total: number }>('SELECT COUNT(*) as total FROM users');
  
  return c.json({
    success: true,
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// Update user role
superAdminRoutes.patch('/users/:id/role', async (c) => {
  const userId = parseInt(c.req.param('id'));
  const { role } = await c.req.json();
  
  if (!['owner', 'admin', 'editor'].includes(role)) {
    return c.json({ error: 'Invalid role' }, 400);
  }
  
  const db = createDbHelper(c.env.DB);
  
  await db.run(
    'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [role, userId]
  );
  
  // Log activity
  const currentUser = await getCurrentUser(c);
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser?.id || null, 'update_user_role', `Updated user ${userId} role to ${role}`]
  );
  
  return c.json({ success: true, message: 'User role updated' });
});

// ==========================================
// AI Provider Management
// ==========================================

// Get AI provider status
superAdminRoutes.get('/ai-status', async (c) => {
  const db = createDbHelper(c.env.DB);
  
  // Get AI settings from database
  const settings = await db.all<{ key: string; value: string }>(
    "SELECT * FROM settings WHERE key LIKE 'ai_%'"
  );
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
  
  // Get Ollama endpoint from environment
  const ollamaEndpoint = c.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
  const ollamaModel = c.env.OLLAMA_MODEL || 'llama3';
  
  // Check Ollama status
  const ollamaStatus = await checkOllamaStatus(ollamaEndpoint);
  
  return c.json({
    success: true,
    ai: {
      provider: settingsMap.ai_provider || 'none',
      enabled: settingsMap.ai_enabled === 'true',
      ollama: {
        endpoint: ollamaEndpoint,
        model: ollamaModel,
        status: ollamaStatus,
      },
      openrouter: {
        configured: !!settingsMap.ai_openrouter_api_key,
      },
    },
  });
});

// Toggle AI provider
superAdminRoutes.post('/ai-toggle', async (c) => {
  const { provider, enabled } = await c.req.json();
  
  const db = createDbHelper(c.env.DB);
  
  if (provider === 'ollama' || provider === 'openrouter') {
    await db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [`ai_provider`, provider]
    );
  }
  
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['ai_enabled', enabled ? 'true' : 'false']
  );
  
  // Log activity
  const currentUser = await getCurrentUser(c);
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser?.id || null, 'update_ai_settings', `AI provider: ${provider}, enabled: ${enabled}`]
  );
  
  return c.json({ success: true, message: 'AI settings updated' });
});

// Update Ollama settings
superAdminRoutes.post('/ai/ollama', async (c) => {
  const { endpoint, model } = await c.req.json();
  
  const db = createDbHelper(c.env.DB);
  
  if (endpoint) {
    await db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['ai_ollama_endpoint', endpoint]
    );
  }
  
  if (model) {
    await db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['ai_ollama_model', model]
    );
  }
  
  // Log activity
  const currentUser = await getCurrentUser(c);
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser?.id || null, 'update_ollama_settings', `Endpoint: ${endpoint}, Model: ${model}`]
  );
  
  return c.json({ success: true, message: 'Ollama settings updated' });
});

// ==========================================
// System Settings
// ==========================================

// Get all settings
superAdminRoutes.get('/settings', async (c) => {
  const db = createDbHelper(c.env.DB);
  
  const settings = await db.all<{ key: string; value: string }>('SELECT * FROM settings');
  
  return c.json({
    success: true,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
  });
});

// Update setting
superAdminRoutes.post('/settings', async (c) => {
  const { key, value } = await c.req.json();
  
  if (!key) {
    return c.json({ error: 'Key is required' }, 400);
  }
  
  const db = createDbHelper(c.env.DB);
  
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
  
  // Log activity
  const currentUser = await getCurrentUser(c);
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser?.id || null, 'update_setting', `Setting ${key} updated`]
  );
  
  return c.json({ success: true, message: 'Setting updated' });
});

// ==========================================
// Activity Log
// ==========================================

// Get activity logs
superAdminRoutes.get('/activity', async (c) => {
  const db = createDbHelper(c.env.DB);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = (page - 1) * limit;
  
  const logs = await db.all(
    `SELECT al.*, u.email as user_email 
     FROM activity_log al 
     LEFT JOIN users u ON al.user_id = u.id 
     ORDER BY al.created_at DESC 
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  
  const [{ total }] = await db.all<{ total: number }>('SELECT COUNT(*) as total FROM activity_log');
  
  return c.json({
    success: true,
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// ==========================================
// Deployment Info
// ==========================================

// Get deployment information
superAdminRoutes.get('/deploy-info', async (c) => {
  return c.json({
    success: true,
    deploy: {
      worker: {
        name: 'l-m-space-in',
        version: c.env.SITE_URL || 'unknown',
      },
      routes: [
        'https://l.m-space.in/*',
        'https://m-space.in/*',
        'https://edgy.frii.site/*',
      ],
      database: {
        type: 'Cloudflare D1',
        name: 'l-m-space-in',
      },
      cache: {
        type: 'Cloudflare KV',
      },
    },
    nextSteps: [
      '1. Add DNS records at frii.site registrar for edgy.frii.site',
      '2. Deploy worker with: npx wrangler deploy',
      '3. Test edgy.frii.site after DNS propagates',
    ],
  });
});
