import { Hono } from 'hono';
import type { Env } from '../config';
import { createDbHelper } from '../db';
import { createLinksService } from '../services/links';
import { createAnalyticsService } from '../services/analytics';
import { authMiddleware, getCurrentUser } from '../middleware/auth';
import { loadAIConfig, generateBlogContent, generateSocialCaption, generateLinkDescription, trackUsage } from '../services/ai';
import { createAITrialService } from '../services/ai-trial';
import type { AIFeatureType } from '../services/ai';

export const apiRoutes = new Hono<{ Bindings: Env }>();

// Apply auth middleware (optional - some endpoints might not require it)
apiRoutes.use('/*', authMiddleware);

// Health check
apiRoutes.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all links (JSON)
apiRoutes.get('/links', async (c) => {
  const isAuthenticated = (c as any).get('isAuthenticated') as boolean;
  
  // If not authenticated, only return active links
  const filters: { page: number; limit: number; is_active?: number } = {
    page: parseInt(c.req.query('page') || '1'),
    limit: Math.min(parseInt(c.req.query('limit') || '20'), 100),
  };

  if (!isAuthenticated) {
    filters.is_active = 1;
  }

  const links = createLinksService(c.env.DB);
  const result = await links.list(filters);

  return c.json({
    links: result.links.map(l => ({
      id: l.id,
      slug: l.slug,
      custom_alias: l.custom_alias,
      url: l.url,
      title: l.title,
      description: l.description,
      redirect_type: l.redirect_type,
      is_active: l.is_active,
      created_at: l.created_at,
      clicks: l.total_clicks,
    })),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      pages: Math.ceil(result.total / filters.limit),
    },
  });
});

// Get single link (JSON)
apiRoutes.get('/links/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const links = createLinksService(c.env.DB);

  const link = await links.getById(id);
  if (!link) {
    return c.json({ error: 'Link not found' }, 404);
  }

  return c.json({ link });
});

// Create link (API)
apiRoutes.post('/links', async (c) => {
  const isAuthenticated = (c as any).get('isAuthenticated') as boolean;
  if (!isAuthenticated) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = getCurrentUser(c)!;
  const body = await c.req.json();

  const links = createLinksService(c.env.DB);

  try {
    const link = await links.create({
      url: body.url,
      slug: body.slug,
      custom_alias: body.custom_alias,
      title: body.title,
      description: body.description,
      redirect_type: body.redirect_type,
      expires_at: body.expires_at,
      max_clicks: body.max_clicks,
      tags: body.tags,
    }, user.id);

    return c.json({ link }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create link' }, 400);
  }
});

// Update link (API)
apiRoutes.put('/links/:id', async (c) => {
  const isAuthenticated = (c as any).get('isAuthenticated') as boolean;
  if (!isAuthenticated) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const links = createLinksService(c.env.DB);

  try {
    const link = await links.update(id, {
      url: body.url,
      slug: body.slug,
      custom_alias: body.custom_alias,
      title: body.title,
      description: body.description,
      redirect_type: body.redirect_type,
      expires_at: body.expires_at,
      max_clicks: body.max_clicks,
      is_active: body.is_active,
      tags: body.tags,
    });

    return c.json({ link });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update link' }, 400);
  }
});

// Delete link (API)
apiRoutes.delete('/links/:id', async (c) => {
  const isAuthenticated = (c as any).get('isAuthenticated') as boolean;
  if (!isAuthenticated) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = parseInt(c.req.param('id'));
  const links = createLinksService(c.env.DB);

  try {
    await links.delete(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete link' }, 400);
  }
});

// Get link analytics (JSON)
apiRoutes.get('/links/:id/analytics', async (c) => {
  const isAuthenticated = (c as any).get('isAuthenticated') as boolean;
  if (!isAuthenticated) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = parseInt(c.req.param('id'));
  const db = createDbHelper(c.env.DB);
  const analytics = createAnalyticsService(db, c.env.CACHE);

  const linkAnalytics = await analytics.getLinkAnalytics(id, 30);

  return c.json({
    link_id: id,
    ...linkAnalytics,
  });
});

// Get global analytics (JSON)
apiRoutes.get('/analytics', async (c) => {
  const isAuthenticated = (c as any).get('isAuthenticated') as boolean;
  if (!isAuthenticated) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = createDbHelper(c.env.DB);
  const analytics = createAnalyticsService(db, c.env.CACHE);

  const summary = await analytics.getGlobalSummary(30);
  const stats = await analytics.getGlobalStats();

  return c.json({
    summary,
    stats,
  });
});

// Get tags (JSON)
apiRoutes.get('/tags', async (c) => {
  const links = createLinksService(c.env.DB);

  const tags = await links.getTags();

  return c.json({ tags });
});

// QR code (JSON)
apiRoutes.get('/links/:id/qr', async (c) => {
  const id = parseInt(c.req.param('id'));
  const size = parseInt(c.req.query('size') || '200');
  const db = createDbHelper(c.env.DB);
  const links = createLinksService(c.env.DB);

  const link = await links.getById(id);
  if (!link) {
    return c.json({ error: 'Link not found' }, 404);
  }

  try {
    const { generateQRSvg } = await import('../services/qr');
    
    // Get SITE_URL from settings database
    const siteSetting = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['site_url']);
    const siteUrl = siteSetting?.value || c.env.SITE_URL || 'https://l.m-space.in';
    const fullUrl = `${siteUrl}/${link.slug}`;
    const svg = await generateQRSvg(fullUrl, size);

    return c.text(svg, 200, { 'Content-Type': 'image/svg+xml' });
  } catch (error) {
    console.error('QR generation error:', error);
    return c.json({ error: 'Failed to generate QR code' }, 500);
  }
});

// AI Generate Content (HTMX partial response)
apiRoutes.post('/ai/generate', async (c) => {
  const isAuthenticated = (c as any).get('isAuthenticated') as boolean;
  if (!isAuthenticated) {
    return c.html('<div class="text-red-600">Please log in to use AI features.</div>', 401);
  }

  const user = getCurrentUser(c)!;
  const db = createDbHelper(c.env.DB);

  // Get settings and load AI config
  const settings = await db.all<{ key: string; value: string }>('SELECT * FROM settings');
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const aiConfig = loadAIConfig(settingsMap);

  if (!aiConfig.enabled) {
    return c.html('<div class="text-yellow-600">AI features are disabled. Enable them in Settings.</div>');
  }

  // Check trial access
  const trialService = createAITrialService(db);
  const canUse = await trialService.canUseAi(user.id);

  if (!canUse.allowed) {
    return c.html(`<div class="text-red-600">${canUse.reason}</div>`);
  }

  // Parse form data
  const formData = await c.req.parseBody();
  const type = formData.type as string;

  try {
    let result;
    let featureType: AIFeatureType;

    switch (type) {
      case 'blog': {
        featureType = 'blog_content';
        const topic = formData.topic as string;
        const tone = (formData.tone as string) || 'professional';
        const length = (formData.length as string) || 'medium';
        const format = (formData.format as string) || 'markdown';

        if (!topic) {
          return c.html('<div class="text-red-600">Topic is required.</div>');
        }

        result = await generateBlogContent(aiConfig, topic, { tone: tone as 'professional' | 'casual' | 'friendly' | 'humorous' | 'informative', length: length as 'short' | 'medium' | 'long', format: format as 'plain' | 'html' | 'markdown' });
        break;
      }

      case 'social': {
        featureType = 'social_caption';
        const url = formData.url as string;
        const title = formData.title as string;
        const platform = (formData.platform as string) || 'twitter';

        if (!url || !title) {
          return c.html('<div class="text-red-600">URL and title are required.</div>');
        }

        result = await generateSocialCaption(aiConfig, url, title, platform as 'twitter' | 'facebook' | 'instagram' | 'linkedin');
        break;
      }

      case 'description': {
        featureType = 'link_description';
        const url = formData.url as string;
        const title = formData.title as string;

        if (!url || !title) {
          return c.html('<div class="text-red-600">URL and title are required.</div>');
        }

        result = await generateLinkDescription(aiConfig, url, title);
        break;
      }

      default:
        return c.html('<div class="text-red-600">Invalid content type.</div>');
    }

    if (!result.success) {
      return c.html(`<div class="text-red-600">${result.error || 'Generation failed.'}</div>`);
    }

    // Deduct credit and track usage
    const deducted = await trialService.deductCredit(user.id, featureType);
    if (!deducted) {
      return c.html('<div class="text-red-600">Failed to deduct credits. Please try again.</div>');
    }

    await trackUsage(db, user.id, featureType, 1, {
      model: result.model,
      promptTokens: result.usage?.prompt_tokens,
      completionTokens: result.usage?.completion_tokens,
    });

    // Get updated credits
    const status = await trialService.getTrialStatus(user.id);
    const creditsHtml = `<div class="text-sm text-gray-600 mb-2">Credits remaining: ${status.creditsRemaining}</div>`;

    return c.html(`
      ${creditsHtml}
      <div class="p-4 bg-gray-50 rounded-lg">
        <div class="prose max-w-none whitespace-pre-wrap">${escapeHtml(result.content)}</div>
        <button onclick="copyToClipboard(\`${escapeHtml(result.content.replace(/`/g, '\\`').replace(/\$/g, '\\$'))}\`)" class="mt-4 px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700">
          Copy to Clipboard
        </button>
      </div>
    `);
  } catch (error) {
    console.error('AI generation error:', error);
    return c.html(`<div class="text-red-600">Error: ${error instanceof Error ? error.message : 'Unknown error'}</div>`);
  }
});

// AI Status (JSON)
apiRoutes.get('/ai/status', async (c) => {
  const isAuthenticated = (c as any).get('isAuthenticated') as boolean;
  if (!isAuthenticated) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = getCurrentUser(c)!;
  const db = createDbHelper(c.env.DB);

  // Get settings
  const settings = await db.all<{ key: string; value: string }>('SELECT * FROM settings');
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const aiConfig = loadAIConfig(settingsMap);

  // Get trial status
  const trialService = createAITrialService(db);
  const trialStatus = await trialService.getTrialStatus(user.id);
  const usageStats = await trialService.getUsageStats(user.id);

  return c.json({
    enabled: aiConfig.enabled,
    configured: aiConfig.provider !== 'none',
    trial: {
      hasActiveTrial: trialStatus.hasActiveTrial,
      daysRemaining: trialStatus.daysRemaining,
      creditsRemaining: trialStatus.creditsRemaining,
      isExpired: trialStatus.isExpired,
    },
    usage: usageStats,
  });
});

// Helper function to escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}