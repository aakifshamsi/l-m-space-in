import { Hono } from 'hono';
import type { Env, SiteType } from './config';
import { detectSiteType, getConfig } from './config';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';
import { apiRoutes } from './routes/api';
import { formsRoutes } from './routes/forms';
import { superAdminRoutes } from './routes/super-admin';
import { formsAutomationRoutes } from './routes/forms-automation';
import { formsAdminRoutes } from './routes/forms-admin';
import { cmsAdminRoutes } from './routes/cms-admin';
import { blogPublicRoutes } from './routes/blog-public';
import { createMagicLinkService } from './services/magic-link';
import { createAuthService } from './services/auth';

// Extend the context type to include site type
type AppContext = {
  Variables: {
    siteType: SiteType;
    siteConfig: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
};

export const app = new Hono<{ Bindings: Env } & AppContext>();

// Multi-site detection middleware - runs for every request
app.use('*', async (c, next) => {
  const hostname = c.req.header('host') || c.env.SITE_URL || '';
  const siteType = detectSiteType(hostname);
  
  // Store site type in context for use in routes
  c.set('siteType', siteType);
  
  // Add site info to context for views
  c.set('siteConfig', getConfig(c.env as any, hostname));
  
  await next();
});

// Health check - must be defined BEFORE public routes to avoid being caught by /:slug
app.get('/health', (c) => {
  const siteType = c.get('siteType');
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    site: siteType
  });
});

// Magic link verification route (public, before admin routes)
// GET /auth/magic-link/verify?token=xxx
app.get('/auth/magic-link/verify', async (c) => {
  const token = c.req.query('token');

  if (!token) {
    return c.redirect('/admin/login?error=Invalid+link');
  }

  const siteUrl = c.env.SITE_URL || 'https://l.m-space.in';
  const jwtSecret = c.env.JWT_SECRET || 'default-jwt-secret-change-me';

  const magicLinkService = createMagicLinkService(c.env.DB, {
    jwtSecret,
    siteUrl,
    expiryMinutes: 15,
  });

  const result = await magicLinkService.verifyMagicLink(token);

  if (result.error) {
    console.log(`Magic link verification failed: ${result.error}`);
    return c.redirect(`/admin/login?error=${encodeURIComponent(result.error)}`);
  }

  if (!result.user) {
    return c.redirect('/admin/login?error=Invalid+link');
  }

  // Create session for the user
  const auth = createAuthService(c.env.DB);
  const sessionToken = await auth.createSession(result.user.id);

  // Set session cookie
  c.header('Set-Cookie', `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);

  return c.redirect('/admin/dashboard');
});

// Admin routes - MUST be defined BEFORE public routes to prevent /:slug from catching /admin
app.route('/admin', adminRoutes);

// Super Admin routes - Master control panel at /admin/super
app.route('/admin/super', superAdminRoutes);

// Public routes - redirect and public pages (includes /:slug which catches everything else)
app.route('/', publicRoutes);

// API routes - JSON API
app.route('/api', apiRoutes);

// Forms routes - Google Forms integration (admin and public)
app.route('/forms', formsRoutes);

// Forms Automation routes - Events, Volunteers, Blog, WhatsApp (admin and public)
app.route('/api/forms-automation', formsAutomationRoutes);
app.route('/admin/forms-automation', formsAdminRoutes);

// CMS Admin routes - Full CMS Backend (Pages, Blog, Auto-Blog, Settings)
app.route('/admin/cms', cmsAdminRoutes);

// Public Blog routes - Blog listing and single post pages
app.route('/', blogPublicRoutes);