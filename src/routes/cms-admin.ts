// ===============================================
// CMS Admin Routes - Full CMS Backend for M-Space
// Handles: Pages, Blog, Auto-Blog, Settings, Theme
// ===============================================

import { Hono } from 'hono';
import type { Env } from '../config';
import type { D1Database } from '@cloudflare/workers-types';
import { createDbHelper } from '../db';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { AutoBlogService } from '../services/auto-blog';
import { loadAIConfig } from '../services/ai';
import { cmsAdminPage, pageEditor, pageList, autoBlogDashboard, autoBlogPostEditor, blogTopicsManager, cmsSettingsPanel } from '../views/cms-admin';

type Variables = {
  userId?: number;
  siteId?: number;
  isAdmin?: boolean;
};

export const cmsAdminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware
cmsAdminRoutes.use('/*', authMiddleware);
cmsAdminRoutes.use('/*', requireAuth);

// ===============================================
// CMS MAIN DASHBOARD
// ===============================================

// CMS Dashboard (mounted at /admin/cms)
cmsAdminRoutes.get('/', async (c) => {
  const db = createDbHelper(c.env.DB);
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  
  const stats = await autoBlogService.getDashboardStats();

  // Get pages count
  const pagesCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM pages');

  // Get blog submissions pending
  const pendingSubmissions = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM blog_submissions WHERE status = 'pending'"
  );

  return c.html(cmsAdminPage({
    stats: {
      autoBlogPosts: stats.total_posts,
      publishedPosts: stats.published,
      scheduledPosts: stats.scheduled,
      draftPosts: stats.drafts,
      pages: pagesCount?.count || 0,
      pendingSubmissions: pendingSubmissions?.count || 0,
      lastGenerated: stats.last_generated
    }
  }));
});

// ===============================================
// PAGES MANAGEMENT
// ===============================================

// List all pages
cmsAdminRoutes.get('/pages', async (c) => {
  const db = createDbHelper(c.env.DB);
  const status = c.req.query('status');
  
  let query = 'SELECT p.*, u.name as author_name FROM pages p LEFT JOIN users u ON p.author_id = u.id';
  const params: unknown[] = [];
  
  if (status) {
    query += ' WHERE p.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY p.updated_at DESC';
  
  const pages = await db.all<unknown[]>(query, params);

  return c.html(pageList(pages as any[], status || ''));
});

// Create new page
cmsAdminRoutes.get('/pages/new', async (c) => {
  return c.html(pageEditor(null));
});

// Edit page
cmsAdminRoutes.get('/pages/:id/edit', async (c) => {
  const db = createDbHelper(c.env.DB);
  const id = parseInt(c.req.param('id'));
  
  const page = await db.get<any>(
    'SELECT p.*, u.name as author_name FROM pages p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = ?',
    [id]
  );

  if (!page) {
    return c.html('<div class="p-4 bg-red-100 text-red-700 rounded-lg">Page not found</div>', 404);
  }

  return c.html(pageEditor(page));
});

// Save page (create or update)
cmsAdminRoutes.post('/pages/save', async (c) => {
  const db = createDbHelper(c.env.DB);
  const body = await c.req.parseBody();
  const userId = c.get('userId') as number;

  const id = body.id ? parseInt(body.id as string) : null;
  const title = body.title as string;
  const slug = (body.slug as string) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const content = body.content as string || '';
  const excerpt = body.excerpt as string || '';
  const status = body.status as string || 'draft';

  if (id) {
    // Update existing page
    await db.run(
      `UPDATE pages SET title = ?, slug = ?, content = ?, excerpt = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [title, slug, content, excerpt, status, id]
    );
    return c.html('<div class="p-4 bg-green-100 text-green-700 rounded-lg">Page updated successfully!</div><script>setTimeout(() => window.location.href = "/admin/cms/pages", 1500);</script>');
  } else {
    // Create new page
    const result = await db.run(
      `INSERT INTO pages (title, slug, content, excerpt, status, author_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [title, slug, content, excerpt, status, userId]
    );
    const newId = result.lastInsertRowid;
    
    if (status === 'published' && newId) {
      await db.run('UPDATE pages SET published_at = CURRENT_TIMESTAMP WHERE id = ?', [newId]);
    }
    
    return c.html('<div class="p-4 bg-green-100 text-green-700 rounded-lg">Page created successfully!</div><script>setTimeout(() => window.location.href = "/admin/cms/pages", 1500);</script>');
  }
});

// Delete page
cmsAdminRoutes.post('/pages/:id/delete', async (c) => {
  const db = createDbHelper(c.env.DB);
  const id = parseInt(c.req.param('id'));
  
  await db.run('DELETE FROM pages WHERE id = ?', [id]);
  
  return c.html('<div class="p-4 bg-green-100 text-green-700 rounded-lg">Page deleted!</div><script>setTimeout(() => window.location.href = "/admin/cms/pages", 1500);</script>');
});

// Publish/Unpublish page
cmsAdminRoutes.post('/pages/:id/toggle-status', async (c) => {
  const db = createDbHelper(c.env.DB);
  const id = parseInt(c.req.param('id'));
  
  const page = await db.get<any>('SELECT * FROM pages WHERE id = ?', [id]);
  if (!page) {
    return c.html('<div class="p-4 bg-red-100 text-red-700 rounded-lg">Page not found</div>', 404);
  }

  const newStatus = page.status === 'published' ? 'draft' : 'published';
  
  if (newStatus === 'published') {
    await db.run('UPDATE pages SET status = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
  } else {
    await db.run('UPDATE pages SET status = ?, published_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
  }

  return c.html(`<div class="p-2 bg-green-100 text-green-700 rounded text-sm">Page ${newStatus}!</div>`);
});

// ===============================================
// AUTO BLOG MANAGEMENT
// ===============================================

// Auto Blog Dashboard
cmsAdminRoutes.get('/blog/auto', async (c) => {
  const db = createDbHelper(c.env.DB);
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  
  const stats = await autoBlogService.getDashboardStats();
  const { posts, total } = await autoBlogService.listPosts({ pageSize: 20 });
  const topics = await autoBlogService.getActiveTopics();
  const settings = await db.all<{ key: string; value: string }>('SELECT * FROM settings', []);
  const settingsMap = Object.fromEntries(settings.map((r: { key: string; value: string }) => [r.key, r.value]));
  const aiConfig = loadAIConfig(settingsMap);

  return c.html(autoBlogDashboard({
    stats,
    posts,
    total,
    topics,
    aiEnabled: aiConfig.enabled,
    aiConfigured: aiConfig.provider !== 'none'
  }));
});

// Generate new blog post
cmsAdminRoutes.post('/blog/auto/generate', async (c) => {
  const db = createDbHelper(c.env.DB);
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const settings = await db.all<{ key: string; value: string }>('SELECT * FROM settings', []);
  const settingsMap = Object.fromEntries(settings.map((r: { key: string; value: string }) => [r.key, r.value]));
  const aiConfig = loadAIConfig(settingsMap);

  // Get a topic to generate
  const topic = await autoBlogService.getTopicForGeneration();
  
  if (!topic) {
    return c.json({ success: false, error: 'No active topics available. Please add topics first.' });
  }

  const result = await autoBlogService.generatePost(topic, aiConfig);
  
  if (result.success) {
    return c.json({ 
      success: true, 
      post: result.post,
      message: 'Blog post generated successfully!'
    });
  } else {
    return c.json({ success: false, error: result.error });
  }
});

// Generate post from specific topic
cmsAdminRoutes.post('/blog/auto/generate/:topicId', async (c) => {
  const db = createDbHelper(c.env.DB);
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const topicId = parseInt(c.req.param('topicId'));
  const settings = await db.all<{ key: string; value: string }>('SELECT * FROM settings', []);
  const settingsMap = Object.fromEntries(settings.map((r: { key: string; value: string }) => [r.key, r.value]));
  const aiConfig = loadAIConfig(settingsMap);

  // Get the topic
  const topics = await autoBlogService.getActiveTopics();
  const topic = topics.find(t => t.id === topicId);
  
  if (!topic) {
    return c.json({ success: false, error: 'Topic not found' });
  }

  const result = await autoBlogService.generatePost(topic, aiConfig);
  
  if (result.success) {
    return c.json({ 
      success: true, 
      post: result.post,
      message: 'Blog post generated successfully!'
    });
  } else {
    return c.json({ success: false, error: result.error });
  }
});

// Edit auto-generated post
cmsAdminRoutes.get('/blog/auto/:id/edit', async (c) => {
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const id = parseInt(c.req.param('id'));

  const post = await autoBlogService.getPostById(id);
  if (!post) {
    return c.html('<div class="p-4 bg-red-100 text-red-700 rounded-lg">Post not found</div>', 404);
  }

  return c.html(autoBlogPostEditor(post));
});

// Save edited post
cmsAdminRoutes.post('/blog/auto/save', async (c) => {
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const body = await c.req.parseBody();

  const id = parseInt(body.id as string);
  await autoBlogService.updatePost(id, {
    title: body.title as string,
    content: body.content as string,
    excerpt: body.excerpt as string,
    category: body.category as string
  });

  return c.html('<div class="p-4 bg-green-100 text-green-700 rounded-lg">Post updated!</div><script>setTimeout(() => window.location.href = "/admin/cms/blog/auto", 1500);</script>');
});

// Publish post
cmsAdminRoutes.post('/blog/auto/:id/publish', async (c) => {
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const id = parseInt(c.req.param('id'));

  await autoBlogService.publishPost(id);
  return c.html(`<div class="p-2 bg-green-100 text-green-700 rounded text-sm">Published!</div>`);
});

// Unpublish post
cmsAdminRoutes.post('/blog/auto/:id/unpublish', async (c) => {
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const id = parseInt(c.req.param('id'));

  await autoBlogService.unpublishPost(id);
  return c.html(`<div class="p-2 bg-gray-100 text-gray-700 rounded text-sm">Unpublished</div>`);
});

// Delete post
cmsAdminRoutes.post('/blog/auto/:id/delete', async (c) => {
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const id = parseInt(c.req.param('id'));

  await autoBlogService.deletePost(id);
  return c.html('<div class="p-4 bg-green-100 text-green-700 rounded-lg">Post deleted!</div><script>setTimeout(() => window.location.href = "/admin/cms/blog/auto", 1500);</script>');
});

// Regenerate post
cmsAdminRoutes.post('/blog/auto/:id/regenerate', async (c) => {
  const db = createDbHelper(c.env.DB);
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const id = parseInt(c.req.param('id'));
  const settings = await db.all<{ key: string; value: string }>('SELECT * FROM settings', []);
  const settingsMap = Object.fromEntries(settings.map((r: { key: string; value: string }) => [r.key, r.value]));
  const aiConfig = loadAIConfig(settingsMap);

  const result = await autoBlogService.regeneratePost(id, aiConfig);
  
  if (result.success) {
    return c.json({ success: true, post: result.post, message: 'Post regenerated!' });
  } else {
    return c.json({ success: false, error: result.error });
  }
});

// ===============================================
// BLOG TOPICS MANAGEMENT
// ===============================================

// Topics manager
cmsAdminRoutes.get('/blog/topics', async (c) => {
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const topics = await autoBlogService.getActiveTopics();

  return c.html(blogTopicsManager(topics));
});

// Add topic
cmsAdminRoutes.post('/blog/topics/add', async (c) => {
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const body = await c.req.parseBody();

  const topic = body.topic as string;
  const category = body.category as string || 'general';
  const frequency = body.frequency as string || 'weekly';

  if (!topic) {
    return c.html('<div class="p-4 bg-red-100 text-red-700 rounded-lg">Topic is required</div>');
  }

  await autoBlogService.addTopic(topic, category, frequency);
  
  return c.html('<div class="p-4 bg-green-100 text-green-700 rounded-lg">Topic added!</div><script>setTimeout(() => window.location.reload(), 1000);</script>');
});

// Toggle topic active status
cmsAdminRoutes.post('/blog/topics/:id/toggle', async (c) => {
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const id = parseInt(c.req.param('id'));

  const topics = await autoBlogService.getActiveTopics();
  const topic = topics.find(t => t.id === id);
  
  if (topic) {
    await autoBlogService.toggleTopic(id, false);
  } else {
    await autoBlogService.toggleTopic(id, true);
  }

  return c.html('<script>window.location.reload();</script>');
});

// Delete topic
cmsAdminRoutes.post('/blog/topics/:id/delete', async (c) => {
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);
  const id = parseInt(c.req.param('id'));

  await autoBlogService.deleteTopic(id);
  
  return c.html('<div class="p-4 bg-green-100 text-green-700 rounded-lg">Topic deleted!</div><script>setTimeout(() => window.location.reload(), 1000);</script>');
});

// ===============================================
// CMS SETTINGS
// ===============================================

cmsAdminRoutes.get('/settings', async (c) => {
  const db = createDbHelper(c.env.DB);
  const settings = await db.all<{ key: string; value: string }>('SELECT * FROM settings', []);
  const settingsMap = Object.fromEntries(settings.map((r: { key: string; value: string }) => [r.key, r.value]));
  
  return c.html(cmsSettingsPanel(settingsMap));
});

// Update CMS settings
cmsAdminRoutes.post('/settings', async (c) => {
  const db = createDbHelper(c.env.DB);
  const body = await c.req.parseBody();

  const updates = [
    ['site_name', body.site_name as string],
    ['site_description', body.site_description as string],
    ['auto_blog_enabled', body.auto_blog_enabled === 'on' ? 'true' : 'false'],
    ['auto_blog_frequency', body.auto_blog_frequency as string || 'weekly'],
  ];

  for (const [key, value] of updates) {
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  return c.html('<div class="p-4 bg-green-100 text-green-700 rounded-lg">Settings saved!</div>');
});

// ===============================================
// SETUP TRIGGER (for scheduled posts)
// ===============================================

cmsAdminRoutes.post('/blog/process-scheduled', async (c) => {
  const autoBlogService = new AutoBlogService(c.env.DB as D1Database);

  const count = await autoBlogService.processScheduledPosts();
  
  return c.json({ success: true, published: count });
});

export default cmsAdminRoutes;
