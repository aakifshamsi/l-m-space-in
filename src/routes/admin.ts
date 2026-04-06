import { Hono } from 'hono';
import type { Env } from '../config';
import { createDbHelper } from '../db';
import { authMiddleware, requireAuth, requireRole, getCurrentUser } from '../middleware/auth';
import { createAuthService } from '../services/auth';
import { createLinksService } from '../services/links';
import { createAnalyticsService } from '../services/analytics';
import { createHandlesService } from '../services/handles';
import { createMagicLinkService } from '../services/magic-link';
import { createEmailService } from '../services/email';
import { renderLoginPage } from '../views/login';
import { renderDashboardPage } from '../views/dashboard';
import { renderLinksPage, renderLinkEditPage } from '../views/links';
import { renderLinkStatsPage } from '../views/link-stats';
import { renderSettingsPage } from '../views/settings';
import { renderUsersPage } from '../views/users';
import { renderAIContentPage } from '../views/ai-content';
import { loadAIConfig } from '../services/ai';
import { createAITrialService } from '../services/ai-trial';

export const adminRoutes = new Hono<{ Bindings: Env }>();

// ==========================================
// DEBUG ROUTES - Ads Diagnostic Tool
// ==========================================

// Apply auth middleware to all /admin/debug* routes
adminRoutes.use('/debug*', authMiddleware);
adminRoutes.use('/debug*', requireAuth);

// Helper to get all diagnostic data
async function getDiagnosticData(env: Env, db: ReturnType<typeof createDbHelper>) {
  const timestamp = new Date().toISOString();

  // Get ads settings from database
  const adsSettings = await db.all<{ key: string; value: string }>(
    "SELECT * FROM settings WHERE key LIKE 'ads%' OR key LIKE 'enable%'"
  );
  const settingsMap = Object.fromEntries(adsSettings.map(s => [s.key, s.value]));

  // Get redirect settings
  const redirectSettings = await db.all<{ key: string; value: string }>(
    "SELECT * FROM settings WHERE key IN ('hide_referrer', 'custom_referrer', 'redirect_type', 'site_url')"
  );
  const redirectMap = Object.fromEntries(redirectSettings.map(s => [s.key, s.value]));

  // Check Monetag key (mask for security)
  const monetagKey = env.MONETAG_API_KEY || '';
  const monetagKeyPresent = !!monetagKey && monetagKey.length > 10;
  const monetagKeyMasked = monetagKeyPresent
    ? `${monetagKey.substring(0, 8)}...${monetagKey.substring(monetagKey.length - 4)}`
    : (monetagKey ? '[TOO SHORT]' : '[NOT SET]');

  // Get worker version from CF-Worker header (if available)
  const workerVersion = env.SITE_URL || 'unknown';

  return {
    timestamp,
    ads: {
      enable_ads_setting: settingsMap.enable_ads ?? 'null',
      ads_on_redirects_setting: settingsMap.ads_on_redirects ?? 'null',
      MONETAG_API_KEY_present: monetagKeyPresent,
      monetag_key_value: monetagKeyMasked,
      ad_free_default: settingsMap['links.ad_free_default'] ?? 'null',
      enable_ads_env: env.ENABLE_ADS ?? 'not set',
    },
    database: {
      ads_settings_query: "SELECT * FROM settings WHERE key LIKE 'ads%'",
      results: adsSettings,
      all_settings: settingsMap,
    },
    worker: {
      version: workerVersion,
      SITE_URL: env.SITE_URL ?? 'not set',
    },
    redirect_config: {
      redirect_type: redirectMap.redirect_type ?? '302 (default)',
      hide_referrer: redirectMap.hide_referrer ?? 'true (default)',
      custom_referrer: redirectMap.custom_referrer ?? 'not set',
      site_url: redirectMap.site_url ?? 'default',
    },
  };
}

// Debug JSON API endpoint
adminRoutes.get('/debug.json', async (c) => {
  try {
    const db = createDbHelper(c.env.DB);
    const data = await getDiagnosticData(c.env, db);
    return c.json(data);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return c.json({
      error: 'Failed to fetch diagnostic data',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Debug HTML page UI
adminRoutes.get('/debug', async (c) => {
  try {
    const db = createDbHelper(c.env.DB);
    const data = await getDiagnosticData(c.env, db);

    // Generate diagnostic results with status indicators
    const checks = [
      {
        name: 'MONETAG_API_KEY Set',
        status: data.ads.MONETAG_API_KEY_present,
        message: data.ads.MONETAG_API_KEY_present
          ? `✓ Present (${data.ads.monetag_key_value})`
          : '✗ Missing - Sign up at https://monetag.com to get your API key',
      },
      {
        name: 'enable_ads Setting',
        status: data.ads.enable_ads_setting === 'true',
        message: data.ads.enable_ads_setting === 'true'
          ? `✓ Enabled (` + data.ads.enable_ads_setting + `)`
          : `✗ Disabled or not set (` + (data.ads.enable_ads_setting || 'null') + `)`,
      },
      {
        name: 'ads_on_redirects Setting',
        status: data.ads.ads_on_redirects_setting === 'true',
        message: data.ads.ads_on_redirects_setting === 'true'
          ? `✓ Enabled (` + data.ads.ads_on_redirects_setting + `)`
          : `✗ Disabled or not set (` + (data.ads.ads_on_redirects_setting || 'null') + `)`,
      },
      {
        name: 'ENABLE_ADS Environment',
        status: data.ads.enable_ads_env !== 'false',
        message: data.ads.enable_ads_env !== 'false'
          ? `✓ Enabled (` + data.ads.enable_ads_env + `)`
          : `✗ Disabled (${data.ads.enable_ads_env})`,
      },
    ];

    const allPassed = checks.every(c => c.status);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ads Diagnostic Tool - m-space</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    // Export diagnostic data as JSON file
    function exportDiagnosticData() {
      const data = ${JSON.stringify(data)};
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ads-diagnostic-${data.timestamp.split('T')[0]}.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  </script>
</head>
<body class="bg-gray-100 min-h-screen">
  <div class="max-w-4xl mx-auto py-8 px-4">
    <!-- Header -->
    <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">🩺 Ads Diagnostic Tool</h1>
          <p class="text-gray-500 mt-1">Check monetization setup and identify issues</p>
        </div>
        <button onclick="exportDiagnosticData()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export JSON
        </button>
      </div>
      <div class="mt-4 text-sm text-gray-400">
        Generated: ${data.timestamp}
      </div>
    </div>

    <!-- Overall Status -->
    <div class="${allPassed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} rounded-xl shadow-md p-6 mb-6 border">
      <div class="flex items-center gap-3">
        <div class="${allPassed ? 'text-emerald-600' : 'text-amber-600'} text-3xl">
          ${allPassed ? '✅' : '⚠️'}
        </div>
        <div>
          <h2 class="text-lg font-semibold ${allPassed ? 'text-emerald-800' : 'text-amber-800'}">
            ${allPassed ? 'All Systems Go' : 'Issues Detected'}
          </h2>
          <p class="${allPassed ? 'text-emerald-600' : 'text-amber-600'}">
            ${allPassed
              ? 'All checks passed. Ads should be working correctly.'
              : 'Some issues found. Review the checks below and fix them.'}
          </p>
        </div>
      </div>
    </div>

    <!-- Status Checks -->
    <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Status Checks</h2>
      <div class="space-y-3">
        ${checks.map(check => `
          <div class="flex items-center justify-between p-4 rounded-lg ${check.status ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}">
            <div class="flex items-center gap-3">
              <div class="text-xl">${check.status ? '✅' : '❌'}</div>
              <span class="font-medium ${check.status ? 'text-emerald-800' : 'text-red-800'}">${check.name}</span>
            </div>
            <span class="text-sm ${check.status ? 'text-emerald-600' : 'text-red-600'}">${check.message}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Fix Instructions -->
    <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">🔧 How to Fix Issues</h2>
      <div class="space-y-4 text-sm text-gray-600">
        <div class="p-4 bg-gray-50 rounded-lg">
          <h3 class="font-semibold text-gray-800 mb-2">1. Set MONETAG_API_KEY</h3>
          <p class="mb-2">Sign up at <a href="https://monetag.com" target="_blank" class="text-blue-600 hover:underline">monetag.com</a> to get your publisher ID.</p>
          <pre class="bg-gray-800 text-gray-200 p-3 rounded overflow-x-auto">npx wrangler secret put MONETAG_API_KEY
# Enter your key when prompted</pre>
        </div>
        <div class="p-4 bg-gray-50 rounded-lg">
          <h3 class="font-semibold text-gray-800 mb-2">2. Enable Ads in Database</h3>
          <p class="mb-2">Run these SQL queries in your D1 database:</p>
          <pre class="bg-gray-800 text-gray-200 p-3 rounded overflow-x-auto">UPDATE settings SET value = 'true' WHERE key = 'enable_ads';
UPDATE settings SET value = 'true' WHERE key = 'ads_on_redirects';</pre>
        </div>
        <div class="p-4 bg-gray-50 rounded-lg">
          <h3 class="font-semibold text-gray-800 mb-2">3. Deploy Changes</h3>
          <pre class="bg-gray-800 text-gray-200 p-3 rounded overflow-x-auto">npx wrangler deploy</pre>
        </div>
      </div>
    </div>

    <!-- Detailed Configuration -->
    <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">📊 Detailed Configuration</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 class="font-semibold text-gray-700 mb-2">Ads Configuration</h3>
          <pre class="bg-gray-100 p-3 rounded text-xs overflow-x-auto">${JSON.stringify(data.ads, null, 2)}</pre>
        </div>
        <div>
          <h3 class="font-semibold text-gray-700 mb-2">Redirect Configuration</h3>
          <pre class="bg-gray-100 p-3 rounded text-xs overflow-x-auto">${JSON.stringify(data.redirect_config, null, 2)}</pre>
        </div>
      </div>
      <div class="mt-4">
        <h3 class="font-semibold text-gray-700 mb-2">Database Settings</h3>
        <pre class="bg-gray-100 p-3 rounded text-xs overflow-x-auto">${JSON.stringify(data.database.all_settings, null, 2)}</pre>
      </div>
    </div>

    <!-- Back to Admin -->
    <div class="text-center">
      <a href="/admin/dashboard" class="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Dashboard
      </a>
    </div>
  </div>
</body>
</html>`;

    return c.html(html);
  } catch (error) {
    console.error('Debug page error:', error);
    return c.html(`<html><body><h1>Error</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p></body></html>`, 500);
  }
});

// Helper function to load enable_ads setting from database
async function getEnableAds(db: ReturnType<typeof createDbHelper>): Promise<boolean> {
  const setting = await db.get<{ value: string }>('SELECT value FROM settings WHERE `key` = ?', ['enable_ads']);
  // Default to true (ads enabled) if setting is not found
  return setting?.value !== 'false';
}

// Root admin path - redirect to login
adminRoutes.get('/', (c) => c.redirect('/admin/login', 302));

// ==========================================
// PUBLIC MAGIC LINK ROUTES (no auth required)
// ==========================================

// POST /admin/magic-link/request - Request a magic link
adminRoutes.post('/magic-link/request', async (c) => {
  const formData = await c.req.parseBody();
  const email = formData.email as string;
  const redirect = (formData.redirect as string) || '/admin/dashboard';

  // Get branding settings for login page
  const db = createDbHelper(c.env.DB);
  const brandingKeys = ['site_name', 'site_tagline', 'site_logo_url', 'site_favicon_url', 'primary_color', 'secondary_color'];
  const brandingSettings = await db.all<{ key: string; value: string }>(
    'SELECT * FROM settings WHERE `key` IN (' + brandingKeys.map(() => '?').join(',') + ')',
    brandingKeys
  );

  const branding: Record<string, string> = {};
  for (const setting of brandingSettings) {
    branding[setting.key] = setting.value;
  }

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  if (!email) {
    return c.html(renderLoginPage({
      redirect,
      error: 'Email address is required',
      branding,
      magicLinkMessage: null,
      enableAds,
    }));
  }

  // Create services
  const siteUrl = c.env.SITE_URL || 'https://l.m-space.in';
  const jwtSecret = c.env.JWT_SECRET || 'default-jwt-secret-change-me';

  const magicLinkService = createMagicLinkService(c.env.DB, {
    jwtSecret,
    siteUrl,
    expiryMinutes: 15,
  });

  const emailService = createEmailService({
    resendApiKey: c.env.RESEND_API_KEY,
    resendFromEmail: c.env.RESEND_FROM_EMAIL,
    siteUrl,
    kv: c.env.CACHE,
  });

  // Check rate limit
  const rateLimit = await magicLinkService.checkRateLimit(email.toLowerCase());

  if (!rateLimit.allowed) {
    const retryAfter = rateLimit.retryAfter || 3600;
    c.header('Retry-After', String(retryAfter));
    return c.json({
      error: 'Too many requests. Please try again later.',
      retryAfter,
    }, 429);
  }

  // Look up user by email
  const user = await db.get<{ id: number; email: string; name: string }>(
    'SELECT id, email, name FROM users WHERE email = ?',
    [email.toLowerCase()]
  );

  if (!user) {
    // Don't reveal whether user exists - still show success message
    return c.html(renderLoginPage({
      redirect,
      error: null,
      branding,
      magicLinkMessage: 'Check your email for a sign-in link (if an account exists)',
      enableAds,
    }));
  }

  // Check if email service is configured
  if (!emailService.isConfigured()) {
    console.warn('Email service not configured - cannot send magic link');
    return c.html(renderLoginPage({
      redirect,
      error: 'Email service not configured. Please use password login.',
      branding,
      magicLinkMessage: null,
      enableAds,
    }));
  }

  // Record rate limit hit
  await magicLinkService.recordRateLimit(email.toLowerCase());

  // Generate magic link
  const { fullUrl } = await magicLinkService.generateMagicLink(user.id, user.email);

  // Send email
  const emailResult = await emailService.sendMagicLinkEmail(user.email, fullUrl, 15);

  if (!emailResult.success && !emailResult.fallbackMode) {
    console.error('Failed to send magic link email:', emailResult.error);
    return c.html(renderLoginPage({
      redirect,
      error: 'Failed to send email. Please try again later.',
      branding,
      magicLinkMessage: null,
      enableAds,
    }));
  }

  // Show success message
  return c.html(renderLoginPage({
    redirect,
    error: null,
    branding,
    magicLinkMessage: emailResult.fallbackMode
      ? `Email service not configured. Check server logs for the magic link.`
      : 'Check your email for a sign-in link',
    enableAds,
  }));
});

// Apply auth middleware to all remaining admin routes
adminRoutes.use('/*', authMiddleware);

// Login page
adminRoutes.get('/login', async (c) => {
  const user = getCurrentUser(c);
  if (user) {
    return c.redirect('/admin/dashboard');
  }

  const redirect = c.req.query('redirect') || '/admin/dashboard';
  
  // Get branding settings for login page
  const db = createDbHelper(c.env.DB);
  const brandingKeys = ['site_name', 'site_tagline', 'site_logo_url', 'site_favicon_url', 'primary_color', 'secondary_color'];
  const brandingSettings = await db.all<{ key: string; value: string }>(
    'SELECT * FROM settings WHERE `key` IN (' + brandingKeys.map(() => '?').join(',') + ')',
    brandingKeys
  );
  
  const branding: Record<string, string> = {};
  for (const setting of brandingSettings) {
    branding[setting.key] = setting.value;
  }

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  return c.html(renderLoginPage({ redirect, error: null, branding, magicLinkMessage: null, enableAds }));
});

// Login action
adminRoutes.post('/login', async (c) => {
  const formData = await c.req.parseBody();
  const email = formData.email as string;
  const password = formData.password as string;
  const redirect = (formData.redirect as string) || '/admin/dashboard';

  // Get branding settings for login page
  const db = createDbHelper(c.env.DB);
  const brandingKeys = ['site_name', 'site_tagline', 'site_logo_url', 'site_favicon_url', 'primary_color', 'secondary_color'];
  const brandingSettings = await db.all<{ key: string; value: string }>(
    'SELECT * FROM settings WHERE `key` IN (' + brandingKeys.map(() => '?').join(',') + ')',
    brandingKeys
  );
  
  const branding: Record<string, string> = {};
  for (const setting of brandingSettings) {
    branding[setting.key] = setting.value;
  }

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  if (!email || !password) {
    return c.html(renderLoginPage({ redirect, error: 'Email and password are required', branding, magicLinkMessage: null, enableAds }));
  }

  const auth = createAuthService(c.env.DB);
  const user = await auth.login(email, password);

  if (!user) {
    return c.html(renderLoginPage({ redirect, error: 'Invalid email or password', branding, magicLinkMessage: null, enableAds }));
  }

  // Create session
  const sessionToken = await auth.createSession(user.id);

  // Set cookie
  c.header('Set-Cookie', `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);

  return c.redirect(redirect);
});

// Logout
adminRoutes.get('/logout', async (c) => {
  const sessionToken = c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];
  
  if (sessionToken) {
    const auth = createAuthService(c.env.DB);
    await auth.deleteSession(sessionToken);
  }

  c.header('Set-Cookie', 'session=; Path=/; HttpOnly; Max-Age=0');
  return c.redirect('/login');
});

// Dashboard (require auth)
adminRoutes.get('/dashboard', requireAuth, async (c) => {
  const user = getCurrentUser(c)!;
  const db = createDbHelper(c.env.DB);
  const links = createLinksService(c.env.DB);
  const analytics = createAnalyticsService(db, c.env.CACHE);

  const [stats, recentLinks, summary] = await Promise.all([
    analytics.getGlobalStats(),
    links.list({ limit: 10 }),
    analytics.getGlobalSummary(30),
  ]);

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  return c.html(renderDashboardPage({
    user,
    stats,
    recentLinks: recentLinks.links,
    summary,
    enableAds,
  }));
});

// Links list
adminRoutes.get('/links', requireAuth, async (c) => {
  const user = getCurrentUser(c)!;
  const db = createDbHelper(c.env.DB);
  const links = createLinksService(c.env.DB);

  const page = parseInt(c.req.query('page') || '1');
  const search = c.req.query('search') || '';
  const isActive = c.req.query('is_active');

  const filters: Parameters<typeof links.list>[0] = {
    page,
    limit: 20,
    search: search || undefined,
  };

  if (isActive !== undefined) {
    filters.is_active = isActive === '1' ? 1 : 0;
  }

  const result = await links.list(filters);
  const tags = await links.getTags();

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  return c.html(renderLinksPage({
    user,
    links: result.links,
    total: result.total,
    page,
    search,
    isActive: isActive ? parseInt(isActive) : undefined,
    tags,
    enableAds,
  }));
});

// Create link page
adminRoutes.get('/links/new', requireAuth, async (c) => {
  const user = getCurrentUser(c)!;
  const db = createDbHelper(c.env.DB);
  const links = createLinksService(c.env.DB);
  const tags = await links.getTags();

  // Ad-free is ON by default for admins (owner and admin roles)
  const adFreeDefault = (user.role === 'owner' || user.role === 'admin') ? 1 : 0;

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  return c.html(renderLinkEditPage({
    user,
    link: null,
    tags,
    siteUrl: c.env.SITE_URL || 'https://l.m-space.in',
    adFreeDefault,
    error: null,
    enableAds,
  }));
});

// Create link action
adminRoutes.post('/links', requireAuth, async (c) => {
  const user = getCurrentUser(c)!;
  const formData = await c.req.parseBody();

  // Ad-free is checked as '1' when checked, unchecked when not present
  const adFreeValue = formData.ad_free === '1' ? 1 : 0;
  // For admins, default to ad-free if not specified
  const isAdmin = user.role === 'owner' || user.role === 'admin';
  const defaultAdFree = isAdmin ? 1 : 0;

  const input = {
    url: formData.url as string,
    slug: (formData.slug as string) || undefined,
    custom_alias: (formData.custom_alias as string) || undefined,
    title: (formData.title as string) || undefined,
    description: (formData.description as string) || undefined,
    redirect_type: (formData.redirect_type as '301' | '302') || '302',
    expires_at: (formData.expires_at as string) || undefined,
    max_clicks: formData.max_clicks ? parseInt(formData.max_clicks as string) : undefined,
    ad_free: adFreeValue || defaultAdFree,
    tags: formData.tags ? (formData.tags as string).split(',').map(Number).filter(n => !isNaN(n)) : [],
  };

  const links = createLinksService(c.env.DB);

  try {
    const link = await links.create(input, user.id);
    
    // Log activity
    const db = createDbHelper(c.env.DB);
    await db.run(
      'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
      [user.id, 'create_link', JSON.stringify({ link_id: link.id, slug: link.slug })]
    );

    return c.redirect(`/admin/links/${link.id}`);
  } catch (error) {
    const db = createDbHelper(c.env.DB);
    const tags = await links.getTags();
    const errorMessage = error instanceof Error ? error.message : 'Failed to create link';
    // Get enable_ads setting
    const enableAds = await getEnableAds(db);
    return c.html(renderLinkEditPage({
      user,
      link: null,
      tags,
      siteUrl: c.env.SITE_URL || 'https://l.m-space.in',
      error: errorMessage,
      enableAds,
    }));
  }
});

// Edit link page
adminRoutes.get('/links/:id/edit', requireAuth, async (c) => {
  const user = getCurrentUser(c)!;
  const id = parseInt(c.req.param('id')!);
  const db = createDbHelper(c.env.DB);
  const links = createLinksService(c.env.DB);

  const link = await links.getById(id);
  if (!link) {
    return c.html('<html><body><h1>404 - Link Not Found</h1></body></html>', 404);
  }

  const tags = await links.getTags();
  const adFreeDefault = (user.role === 'owner' || user.role === 'admin') ? 1 : 0;

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  return c.html(renderLinkEditPage({
    user,
    link,
    tags,
    siteUrl: c.env.SITE_URL || 'https://l.m-space.in',
    adFreeDefault,
    error: null,
    enableAds,
  }));
});

// Update link action
adminRoutes.post('/links/:id', requireAuth, async (c) => {
  const user = getCurrentUser(c)!;
  const id = parseInt(c.req.param('id')!);
  const formData = await c.req.parseBody();

  // Ad-free is checked as '1' when checked, unchecked when not present
  const adFreeValue = formData.ad_free === '1' ? 1 : 0;

  const input = {
    url: formData.url as string,
    slug: (formData.slug as string) || undefined,
    custom_alias: (formData.custom_alias as string) || undefined,
    title: (formData.title as string) || undefined,
    description: (formData.description as string) || undefined,
    redirect_type: (formData.redirect_type as '301' | '302') || '302',
    expires_at: (formData.expires_at as string) || null,
    max_clicks: formData.max_clicks ? parseInt(formData.max_clicks as string) : null,
    ad_free: adFreeValue,
    tags: formData.tags ? (formData.tags as string).split(',').map(Number).filter(n => !isNaN(n)) : [],
  };

  const links = createLinksService(c.env.DB);

  try {
    await links.update(id, input);

    // Log activity
    const db = createDbHelper(c.env.DB);
    await db.run(
      'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
      [user.id, 'update_link', JSON.stringify({ link_id: id })]
    );

    return c.redirect(`/admin/links/${id}`);
  } catch (error) {
    const db = createDbHelper(c.env.DB);
    const tags = await links.getTags();
    const link = await links.getById(id);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update link';
    // Get enable_ads setting
    const enableAds = await getEnableAds(db);
    return c.html(renderLinkEditPage({
      user,
      link,
      tags,
      siteUrl: c.env.SITE_URL || 'https://l.m-space.in',
      error: errorMessage,
      enableAds,
    }));
  }
});

// Link detail/stats page
adminRoutes.get('/links/:id', requireAuth, async (c) => {
  const user = getCurrentUser(c)!;
  const id = parseInt(c.req.param('id')!);
  const db = createDbHelper(c.env.DB);
  const links = createLinksService(c.env.DB);
  const analytics = createAnalyticsService(db, c.env.CACHE);

  const link = await links.getById(id);
  if (!link) {
    return c.html('<html><body><h1>404 - Link Not Found</h1></body></html>', 404);
  }

  const linkAnalytics = await analytics.getLinkAnalytics(id, 30);
  const recentClicks = await analytics.getRecentClicks(id, 50);

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  return c.html(renderLinkStatsPage({
    user,
    link,
    siteUrl: c.env.SITE_URL || 'https://l.m-space.in',
    analytics: linkAnalytics,
    recentClicks,
    enableAds,
  }));
});

// Delete (deactivate) link
adminRoutes.post('/links/:id/deactivate', requireAuth, async (c) => {
  const user = getCurrentUser(c)!;
  const id = parseInt(c.req.param('id')!);
  const links = createLinksService(c.env.DB);

  await links.deactivate(id);

  // Log activity
  const db = createDbHelper(c.env.DB);
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [user.id, 'deactivate_link', JSON.stringify({ link_id: id })]
  );

  return c.redirect('/admin/links');
});

// Reactivate link
adminRoutes.post('/links/:id/reactivate', requireAuth, async (c) => {
  const user = getCurrentUser(c)!;
  const id = parseInt(c.req.param('id')!);
  const links = createLinksService(c.env.DB);

  await links.reactivate(id);

  // Log activity
  const db = createDbHelper(c.env.DB);
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [user.id, 'reactivate_link', JSON.stringify({ link_id: id })]
  );

  return c.redirect(`/admin/links/${id}`);
});

// Delete link permanently
adminRoutes.post('/links/:id/delete', requireRole('owner', 'admin'), async (c) => {
  const user = getCurrentUser(c)!;
  const id = parseInt(c.req.param('id')!);
  const links = createLinksService(c.env.DB);

  await links.delete(id);

  // Log activity
  const db = createDbHelper(c.env.DB);
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [user.id, 'delete_link', JSON.stringify({ link_id: id })]
  );

  return c.redirect('/admin/links');
});

// Settings page
adminRoutes.get('/settings', requireRole('owner', 'admin'), async (c) => {
  const user = getCurrentUser(c)!;
  const db = createDbHelper(c.env.DB);

  // Get settings
  const settings = await db.all<{ key: string; value: string }>('SELECT * FROM settings');
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  return c.html(renderSettingsPage({
    user,
    settings: settingsMap,
    enableAds,
  }));
});

// Update settings
adminRoutes.post('/settings', requireRole('owner', 'admin'), async (c) => {
  const user = getCurrentUser(c)!;
  const formData = await c.req.parseBody();
  const db = createDbHelper(c.env.DB);

  const settingsToUpdate = [
    'site_description',
    'site_url',
    'default_redirect_type',
    'links_per_page',
    'ai_provider',
    // SEO settings
    'seo_title',
    'seo_description',
    'seo_keywords',
    // Banner settings
    'banner_text',
    'banner_link',
    // Referrer settings
    'custom_referrer',
    // Branding settings
    'site_name',
    'site_tagline',
    'site_logo_url',
    'site_favicon_url',
    // Ad moderation
    'ad_report_email',
  ];

  for (const key of settingsToUpdate) {
    if (formData[key]) {
      await db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, formData[key] as string]
      );
    }
  }

  // Handle hex color validation for branding colors
  if (formData.primary_color) {
    const primaryColor = formData.primary_color as string;
    if (/^#?[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      const normalizedColor = primaryColor.startsWith('#') ? primaryColor : `#${primaryColor}`;
      await db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['primary_color', normalizedColor]
      );
    }
  }

  if (formData.secondary_color) {
    const secondaryColor = formData.secondary_color as string;
    if (/^#?[0-9A-Fa-f]{6}$/.test(secondaryColor)) {
      const normalizedColor = secondaryColor.startsWith('#') ? secondaryColor : `#${secondaryColor}`;
      await db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['secondary_color', normalizedColor]
      );
    }
  }

  // Handle checkbox settings - they only appear in formData when checked
  const enableAdsValue = formData.enable_ads === 'true' ? 'true' : 'false';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['enable_ads', enableAdsValue]
  );

  const adsOnRedirectsValue = formData.ads_on_redirects === 'true' ? 'true' : 'false';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['ads_on_redirects', adsOnRedirectsValue]
  );

  // SEO settings
  const enableSeoValue = formData.enable_seo === 'true' ? 'true' : 'false';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['enable_seo', enableSeoValue]
  );

  // Banner settings
  const showBannerValue = formData.show_banner === 'true' ? 'true' : 'false';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['show_banner', showBannerValue]
  );

  // Credits settings
  const showCreditsValue = formData.show_credits === 'true' ? 'true' : 'false';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['show_credits', showCreditsValue]
  );

  // Referrer settings
  const hideReferrerValue = formData.hide_referrer === 'true' ? 'true' : 'false';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['hide_referrer', hideReferrerValue]
  );

  // Instagram embed settings
  const instagramEmbedValue = formData.instagram_embed === 'true' ? 'true' : 'false';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['instagram_embed', instagramEmbedValue]
  );

  // AI settings
  const aiEnabledValue = formData.ai_enabled === 'true' ? 'true' : 'false';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['ai_enabled', aiEnabledValue]
  );

  const aiOllamaEndpoint = formData.ai_ollama_endpoint as string || 'http://localhost:11434';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['ai_ollama_endpoint', aiOllamaEndpoint]
  );

  const aiOllamaModel = formData.ai_ollama_model as string || 'llama3';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['ai_ollama_model', aiOllamaModel]
  );

  const aiOpenrouterApiKey = formData.ai_openrouter_api_key as string || '';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['ai_openrouter_api_key', aiOpenrouterApiKey]
  );

  const aiOpenrouterModel = formData.ai_openrouter_model as string || 'anthropic/claude-3-haiku';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['ai_openrouter_model', aiOpenrouterModel]
  );

  const aiTrialDays = formData.ai_trial_days as string || '30';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['ai_trial_days', aiTrialDays]
  );

  const aiTrialCredits = formData.ai_trial_credits as string || '100';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['ai_trial_credits', aiTrialCredits]
  );

  const aiDailyReset = formData.ai_daily_reset === 'true' ? 'true' : 'false';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['ai_daily_reset', aiDailyReset]
  );

  // Log activity
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [user.id, 'update_settings', 'Updated site settings']
  );

  return c.redirect('/admin/settings');
});

// Users management (owner/admin only)
adminRoutes.get('/users', requireRole('owner', 'admin'), async (c) => {
  const user = getCurrentUser(c)!;
  const db = createDbHelper(c.env.DB);
  const auth = createAuthService(c.env.DB);

  const users = await auth.getUsers();

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  return c.html(renderUsersPage({
    user,
    users,
    enableAds,
  }));
});

// Create user
adminRoutes.post('/users', requireRole('owner'), async (c) => {
  const user = getCurrentUser(c)!;
  const formData = await c.req.parseBody();
  const auth = createAuthService(c.env.DB);

  try {
    await auth.register(
      formData.email as string,
      formData.password as string,
      formData.name as string,
      formData.role as string
    );

    // Log activity
    const db = createDbHelper(c.env.DB);
    await db.run(
      'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
      [user.id, 'create_user', JSON.stringify({ email: formData.email })]
    );

    return c.redirect('/admin/users');
  } catch (error) {
    return c.html('<html><body><h1>Error</h1><p>Failed to create user</p></body></html>', 400);
  }
});

// Update user
adminRoutes.post('/users/:id', requireRole('owner'), async (c) => {
  const user = getCurrentUser(c)!;
  const id = parseInt(c.req.param('id')!);
  const formData = await c.req.parseBody();
  const auth = createAuthService(c.env.DB);

  await auth.updateUser(id, {
    name: formData.name as string,
    email: formData.email as string,
    role: formData.role as string,
  });

  // Log activity
  const db = createDbHelper(c.env.DB);
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [user.id, 'update_user', JSON.stringify({ user_id: id })]
  );

  return c.redirect('/admin/users');
});

// Delete user
adminRoutes.post('/users/:id/delete', requireRole('owner'), async (c) => {
  const user = getCurrentUser(c)!;
  const id = parseInt(c.req.param('id')!);

  // Prevent self-deletion
  if (id === user.id) {
    return c.html('<html><body><h1>Error</h1><p>Cannot delete your own account</p></body></html>', 400);
  }

  const auth = createAuthService(c.env.DB);
  await auth.deleteUser(id);

  // Log activity
  const db = createDbHelper(c.env.DB);
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [user.id, 'delete_user', JSON.stringify({ user_id: id })]
  );

  return c.redirect('/admin/users');
});

// Tags management
adminRoutes.get('/tags', requireAuth, async (c) => {
  const user = getCurrentUser(c)!;
  const links = createLinksService(c.env.DB);
  const tags = await links.getTags();

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tags - Muslim Space Link</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
      <nav class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/admin/dashboard" class="text-xl font-bold text-emerald-600">Muslim Space Link</a>
          <div class="flex gap-4">
            <a href="/admin/dashboard" class="text-gray-600 hover:text-emerald-600">Dashboard</a>
            <a href="/admin/links" class="text-gray-600 hover:text-emerald-600">Links</a>
            <a href="/admin/settings" class="text-gray-600 hover:text-emerald-600">Settings</a>
            <span class="text-gray-600">${user.name} (${user.role})</span>
            <a href="/admin/logout" class="text-red-600 hover:text-red-700">Logout</a>
          </div>
        </div>
      </nav>
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold">Tags</h1>
          <a href="/admin/tags/new" class="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700">New Tag</a>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <table class="w-full">
            <thead>
              <tr class="border-b">
                <th class="text-left py-2">Name</th>
                <th class="text-left py-2">Color</th>
                <th class="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tags.map(tag => `
                <tr class="border-b">
                  <td class="py-2">${tag.name}</td>
                  <td class="py-2">
                    <span class="inline-block w-6 h-6 rounded" style="background-color: ${tag.color}"></span>
                    <span class="ml-2">${tag.color}</span>
                  </td>
                  <td class="py-2">
                    <form method="POST" action="/admin/tags/${tag.id}/delete" class="inline">
                      <button type="submit" class="text-red-600 hover:text-red-700">Delete</button>
                    </form>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Create tag
adminRoutes.post('/tags', requireAuth, async (c) => {
  const formData = await c.req.parseBody();
  const links = createLinksService(c.env.DB);

  await links.createTag(formData.name as string, formData.color as string);

  return c.redirect('/admin/tags');
});

// Delete tag
adminRoutes.post('/tags/:id/delete', requireAuth, async (c) => {
  const id = parseInt(c.req.param('id')!);
  const links = createLinksService(c.env.DB);

  await links.deleteTag(id);

  return c.redirect('/admin/tags');
});

// ===========================================
// SOCIAL HANDLES MANAGEMENT
// ===========================================

// Handles list page
adminRoutes.get('/handles', requireRole('owner', 'admin'), async (c) => {
  const user = getCurrentUser(c)!;
  const handles = createHandlesService(c.env.DB);
  const allHandles = await handles.getAll();

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Social Handles - Muslim Space Link</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
      <nav class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/admin/dashboard" class="text-xl font-bold text-emerald-600">Muslim Space Link</a>
          <div class="flex gap-4">
            <a href="/admin/dashboard" class="text-gray-600 hover:text-emerald-600">Dashboard</a>
            <a href="/admin/links" class="text-gray-600 hover:text-emerald-600">Links</a>
            <a href="/admin/settings" class="text-gray-600 hover:text-emerald-600">Settings</a>
            <span class="text-gray-600">${user.name} (${user.role})</span>
            <a href="/admin/logout" class="text-red-600 hover:text-red-700">Logout</a>
          </div>
        </div>
      </nav>
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold">Social Handles</h1>
          <a href="/admin/handles/new" class="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700">Add Handle</a>
        </div>
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left py-3 px-4 font-medium text-gray-500">Platform</th>
                <th class="text-left py-3 px-4 font-medium text-gray-500">Handle</th>
                <th class="text-left py-3 px-4 font-medium text-gray-500">URL</th>
                <th class="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th class="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${allHandles.length === 0 ? `
                <tr>
                  <td colspan="5" class="py-8 text-center text-gray-500">No handles configured. Add your social media handles.</td>
                </tr>
              ` : allHandles.map(handle => `
                <tr class="border-t">
                  <td class="py-3 px-4 capitalize">${handle.platform}</td>
                  <td class="py-3 px-4">@${handle.handle}</td>
                  <td class="py-3 px-4">
                    <a href="${handle.url}" target="_blank" class="text-blue-600 hover:underline">${handle.url}</a>
                  </td>
                  <td class="py-3 px-4">
                    ${handle.is_enabled ? 
                      `<span class="px-2 py-1 rounded text-xs bg-green-100 text-green-700">Enabled</span>` :
                      `<span class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">Disabled</span>`
                    }
                    ${handle.is_primary ? 
                      `<span class="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 ml-1">Primary</span>` : ''
                    }
                  </td>
                  <td class="py-3 px-4">
                    <a href="/admin/handles/${handle.id}/edit" class="text-blue-600 hover:text-blue-700 mr-3">Edit</a>
                    <form method="POST" action="/admin/handles/${handle.id}/toggle" class="inline mr-3">
                      <button type="submit" class="text-${handle.is_enabled ? 'red' : 'green'}-600 hover:text-${handle.is_enabled ? 'red' : 'green'}-700">
                        ${handle.is_enabled ? 'Disable' : 'Enable'}
                      </button>
                    </form>
                    <form method="POST" action="/admin/handles/${handle.id}/delete" class="inline">
                      <button type="submit" class="text-red-600 hover:text-red-700" onclick="return confirm('Delete this handle?')">Delete</button>
                    </form>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
  `);
});

// New handle page
adminRoutes.get('/handles/new', requireRole('owner', 'admin'), async (c) => {
  const user = getCurrentUser(c)!;

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Add Handle - Muslim Space Link</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
      <nav class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/admin/dashboard" class="text-xl font-bold text-emerald-600">Muslim Space Link</a>
          <div class="flex gap-4">
            <a href="/admin/dashboard" class="text-gray-600 hover:text-emerald-600">Dashboard</a>
            <a href="/admin/handles" class="text-gray-600 hover:text-emerald-600">Handles</a>
            <span class="text-gray-600">${user.name}</span>
            <a href="/admin/logout" class="text-red-600">Logout</a>
          </div>
        </div>
      </nav>
      <div class="max-w-xl mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-xl font-bold mb-4">Add Social Handle</h1>
          <form method="POST" action="/admin/handles" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select name="platform" required class="w-full px-4 py-2 border rounded-lg">
                <option value="instagram">Instagram</option>
                <option value="twitter">Twitter/X</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Handle</label>
              <input type="text" name="handle" required placeholder="username" class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input type="url" name="url" required placeholder="https://..." class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Display Name (optional)</label>
              <input type="text" name="display_name" placeholder="Display name" class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" name="is_enabled" value="1" id="is_enabled" class="rounded">
              <label for="is_enabled" class="text-sm text-gray-700">Enable immediately</label>
            </div>
            <div class="flex gap-3 pt-4">
              <a href="/admin/handles" class="px-4 py-2 border rounded-lg">Cancel</a>
              <button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Add Handle</button>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Create handle
adminRoutes.post('/handles', requireRole('owner', 'admin'), async (c) => {
  const formData = await c.req.parseBody();
  const handles = createHandlesService(c.env.DB);

  try {
    await handles.create({
      platform: formData.platform as any,
      handle: formData.handle as string,
      url: formData.url as string,
      display_name: formData.display_name as string,
      is_enabled: formData.is_enabled === '1' ? 1 : 0,
    });
  } catch (error) {
    console.error('Error creating handle:', error);
  }

  return c.redirect('/admin/handles');
});

// Edit handle page
adminRoutes.get('/handles/:id/edit', requireRole('owner', 'admin'), async (c) => {
  const user = getCurrentUser(c)!;
  const id = parseInt(c.req.param('id')!);
  const handles = createHandlesService(c.env.DB);

  const handle = await handles.getById(id);
  if (!handle) {
    return c.html('<html><body><h1>404 - Handle Not Found</h1></body></html>', 404);
  }

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Edit Handle - Muslim Space Link</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
      <nav class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/admin/dashboard" class="text-xl font-bold text-emerald-600">Muslim Space Link</a>
          <div class="flex gap-4">
            <a href="/admin/dashboard" class="text-gray-600 hover:text-emerald-600">Dashboard</a>
            <a href="/admin/handles" class="text-gray-600 hover:text-emerald-600">Handles</a>
            <span class="text-gray-600">${user.name}</span>
            <a href="/admin/logout" class="text-red-600">Logout</a>
          </div>
        </div>
      </nav>
      <div class="max-w-xl mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-xl font-bold mb-4">Edit Handle</h1>
          <form method="POST" action="/admin/handles/${id}" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select name="platform" required class="w-full px-4 py-2 border rounded-lg">
                <option value="instagram" ${handle.platform === 'instagram' ? 'selected' : ''}>Instagram</option>
                <option value="twitter" ${handle.platform === 'twitter' ? 'selected' : ''}>Twitter/X</option>
                <option value="tiktok" ${handle.platform === 'tiktok' ? 'selected' : ''}>TikTok</option>
                <option value="youtube" ${handle.platform === 'youtube' ? 'selected' : ''}>YouTube</option>
                <option value="facebook" ${handle.platform === 'facebook' ? 'selected' : ''}>Facebook</option>
                <option value="linkedin" ${handle.platform === 'linkedin' ? 'selected' : ''}>LinkedIn</option>
                <option value="other" ${handle.platform === 'other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Handle</label>
              <input type="text" name="handle" required value="${handle.handle}" class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input type="url" name="url" required value="${handle.url}" class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Display Name (optional)</label>
              <input type="text" name="display_name" value="${handle.display_name || ''}" class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" name="is_enabled" value="1" id="is_enabled" ${handle.is_enabled ? 'checked' : ''} class="rounded">
              <label for="is_enabled" class="text-sm text-gray-700">Enabled</label>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" name="is_primary" value="1" id="is_primary" ${handle.is_primary ? 'checked' : ''} class="rounded">
              <label for="is_primary" class="text-sm text-gray-700">Set as primary for platform</label>
            </div>
            <div class="flex gap-3 pt-4">
              <a href="/admin/handles" class="px-4 py-2 border rounded-lg">Cancel</a>
              <button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Update Handle</button>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Update handle
adminRoutes.post('/handles/:id', requireRole('owner', 'admin'), async (c) => {
  const id = parseInt(c.req.param('id')!);
  const formData = await c.req.parseBody();
  const handles = createHandlesService(c.env.DB);

  await handles.update(id, {
    platform: formData.platform as any,
    handle: formData.handle as string,
    url: formData.url as string,
    display_name: formData.display_name as string || null,
    is_enabled: formData.is_enabled === '1' ? 1 : 0,
    is_primary: formData.is_primary === '1' ? 1 : 0,
  });

  // If set as primary, update other handles
  if (formData.is_primary === '1') {
    await handles.setPrimary(id);
  }

  return c.redirect('/admin/handles');
});

// Toggle handle enabled/disabled
adminRoutes.post('/handles/:id/toggle', requireRole('owner', 'admin'), async (c) => {
  const id = parseInt(c.req.param('id')!);
  const handles = createHandlesService(c.env.DB);

  const handle = await handles.getById(id);
  if (handle) {
    await handles.setEnabled(id, !handle.is_enabled);
  }

  return c.redirect('/admin/handles');
});

// Delete handle
adminRoutes.post('/handles/:id/delete', requireRole('owner', 'admin'), async (c) => {
  const id = parseInt(c.req.param('id')!);
  const handles = createHandlesService(c.env.DB);

  await handles.delete(id);

  return c.redirect('/admin/handles');
});

// ===========================================
// BRANDING API ENDPOINTS
// ===========================================

// Helper function to validate hex color
function isValidHexColor(color: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(color);
}

// Normalize hex color (ensure it starts with #)
function normalizeHexColor(color: string): string {
  return color.startsWith('#') ? color : `#${color}`;
}

// Get branding settings
adminRoutes.get('/api/branding', requireRole('owner', 'admin'), async (c) => {
  const db = createDbHelper(c.env.DB);

  const brandingKeys = [
    'site_name',
    'site_tagline',
    'site_logo_url',
    'site_favicon_url',
    'primary_color',
    'secondary_color',
  ];

  const settings = await db.all<{ key: string; value: string }>(
    'SELECT * FROM settings WHERE `key` IN (' + brandingKeys.map(() => '?').join(',') + ')',
    brandingKeys
  );

  const branding: Record<string, string> = {};
  for (const setting of settings) {
    branding[setting.key] = setting.value;
  }

  // Apply defaults
  if (!branding.primary_color) branding.primary_color = '#10B981';
  if (!branding.secondary_color) branding.secondary_color = '#F59E0B';
  if (!branding.site_name) branding.site_name = 'm-space';

  return c.json(branding);
});

// Save branding settings
adminRoutes.post('/api/branding', requireRole('owner', 'admin'), async (c) => {
  const user = getCurrentUser(c)!;
  const formData = await c.req.parseBody();
  const db = createDbHelper(c.env.DB);

  const brandingKeys = [
    'site_name',
    'site_tagline',
    'site_logo_url',
    'site_favicon_url',
    'primary_color',
    'secondary_color',
  ];

  for (const key of brandingKeys) {
    const value = formData[key];
    if (value !== undefined && value !== '') {
      // Validate hex colors
      if (key === 'primary_color' || key === 'secondary_color') {
        if (!isValidHexColor(value as string)) {
          return c.json({ error: `Invalid hex color for ${key}. Use format: #RRGGBB or RRGGBB` }, 400);
        }
        // Normalize to include # prefix
        await db.run(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [key, normalizeHexColor(value as string)]
        );
      } else {
        await db.run(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [key, value as string]
        );
      }
    }
  }

  // Log activity
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [user.id, 'update_branding', 'Updated branding settings']
  );

  return c.json({ success: true });
});

// AI Content Page
adminRoutes.get('/ai-content', async (c) => {
  const user = getCurrentUser(c)!;
  const db = createDbHelper(c.env.DB);

  // Get all settings
  const settings = await db.all<{ key: string; value: string }>('SELECT * FROM settings');
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

  // Load AI config
  const aiConfig = loadAIConfig(settingsMap);

  // Get trial status
  const trialService = createAITrialService(db);
  const trialStatus = await trialService.getTrialStatus(user.id);

  // Get enable_ads setting
  const enableAds = await getEnableAds(db);

  return c.html(renderAIContentPage({
    user,
    settings: settingsMap,
    aiConfig,
    trialStatus,
    enableAds,
  }));
});

// Start AI Trial
adminRoutes.post('/ai-content/start-trial', async (c) => {
  const user = getCurrentUser(c)!;
  const db = createDbHelper(c.env.DB);

  // Create trial
  const trialService = createAITrialService(db);
  await trialService.createTrial(user.id);

  // Log activity
  await db.run(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
    [user.id, 'start_ai_trial', 'Started AI free trial']
  );

  return c.redirect('/admin/ai-content?message=Trial+started+successfully');
});