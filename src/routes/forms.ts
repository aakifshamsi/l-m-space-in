import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../config';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { createGoogleFormsService } from '../services/google-forms';
import { createProtectedLinkService } from '../services/protected-link';

export const formsRoutes = new Hono<{ Bindings: Env }>();

// Helper to parse and validate ID parameter
function parseFormId(c: Context<{ Bindings: Env }>): number | null {
  const idParam = c.req.param('id');
  if (!idParam) return null;
  const id = parseInt(idParam, 10);
  return isNaN(id) ? null : id;
}

/**
 * GET /forms - List all form integrations (admin only)
 */
formsRoutes.get('/', requireAuth, async (c) => {
  // User is authenticated via requireAuth middleware
  const formsService = createGoogleFormsService(c.env.DB);

  try {
    const forms = await formsService.getFormIntegrations();
    const formsWithStats = await Promise.all(
      forms.map(async (form) => {
        const stats = await formsService.getFormStats(form.id);
        const linkStats = await createProtectedLinkService(c.env.DB, c.env.JWT_SECRET || 'default-jwt-secret')
          .getProtectedLinkStats(form.id);
        return {
          ...form,
          stats,
          linkStats,
        };
      })
    );

    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Form Integrations - Admin</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body class="bg-gray-50">
        <div class="min-h-screen">
          <!-- Header -->
          <header class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
              <div class="flex justify-between items-center">
                <h1 class="text-2xl font-bold text-gray-900">Form Integrations</h1>
                <a href="/admin/dashboard" class="text-blue-600 hover:text-blue-800">← Back to Dashboard</a>
              </div>
            </div>
          </header>

          <!-- Main Content -->
          <main class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <!-- Info Banner -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p class="text-blue-800 text-sm">
                <strong>Form Embed Mode:</strong> Forms are displayed in embed-only mode. 
                Google Sheets sync requires server-side configuration.
              </p>
            </div>

            <!-- Forms Grid -->
            <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              ${formsWithStats.map((form) => `
                <div class="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                      <h3 class="text-lg font-semibold text-gray-900">${form.name}</h3>
                      <span class="px-2 py-1 text-xs rounded ${form.embed_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">
                        ${form.embed_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    
                    <p class="text-sm text-gray-500 mb-4 truncate" title="${form.google_form_id}">
                      ID: ${form.google_form_id.substring(0, 20)}...
                    </p>

                    <!-- Stats -->
                    <div class="grid grid-cols-3 gap-2 mb-4">
                      <div class="text-center p-2 bg-gray-50 rounded">
                        <div class="text-lg font-semibold text-gray-900">${form.stats.total_views || 0}</div>
                        <div class="text-xs text-gray-500">Views</div>
                      </div>
                      <div class="text-center p-2 bg-gray-50 rounded">
                        <div class="text-lg font-semibold text-green-600">${form.stats.total_submits || 0}</div>
                        <div class="text-xs text-gray-500">Submits</div>
                      </div>
                      <div class="text-center p-2 bg-gray-50 rounded">
                        <div class="text-lg font-semibold text-blue-600">${form.linkStats.active_links || 0}</div>
                        <div class="text-xs text-gray-500">Links</div>
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex flex-col gap-2">
                      <a href="/forms/${form.id}/embed" target="_blank" 
                         class="w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                        View Embed
                      </a>
                      <button onclick="showCreateLinkModal(${form.id}, '${form.name.replace(/'/g, "\\'")}')"
                              class="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm">
                        Create Protected Link
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>

            ${formsWithStats.length === 0 ? `
              <div class="text-center py-12">
                <p class="text-gray-500">No form integrations configured.</p>
                <p class="text-sm text-gray-400 mt-2">Run migration 007_google_forms.sql to seed the main form.</p>
              </div>
            ` : ''}
          </main>
        </div>

        <!-- Create Protected Link Modal -->
        <div id="createLinkModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 class="text-lg font-semibold mb-4">Create Protected Link</h2>
            <form id="createLinkForm" class="space-y-4">
              <input type="hidden" id="formId" name="formId">
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <input type="text" id="purpose" name="purpose" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md"
                       placeholder="e.g., prefill, admin-review">
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Prefill Data (JSON)</label>
                <textarea id="prefillData" name="prefillData" rows="3"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                          placeholder='{"entry.123456": "prefilled value"}'></textarea>
                <p class="text-xs text-gray-500 mt-1">Optional: Key-value pairs for form field pre-fill</p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Expires In (hours)</label>
                  <input type="number" id="expiresIn" name="expiresIn" min="0"
                         class="w-full px-3 py-2 border border-gray-300 rounded-md"
                         placeholder="Leave empty for no expiry">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Max Uses</label>
                  <input type="number" id="maxUses" name="maxUses" min="0"
                         class="w-full px-3 py-2 border border-gray-300 rounded-md"
                         placeholder="Leave empty for unlimited">
                </div>
              </div>

              <div class="flex justify-end gap-3 pt-4">
                <button type="button" onclick="hideCreateLinkModal()"
                        class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit"
                        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Create Link
                </button>
              </div>
            </form>
          </div>
        </div>

        <script>
          function showCreateLinkModal(formId, formName) {
            document.getElementById('formId').value = formId;
            document.getElementById('purpose').value = '';
            document.getElementById('prefillData').value = '';
            document.getElementById('expiresIn').value = '';
            document.getElementById('maxUses').value = '';
            document.getElementById('createLinkModal').classList.remove('hidden');
          }

          function hideCreateLinkModal() {
            document.getElementById('createLinkModal').classList.add('hidden');
          }

          document.getElementById('createLinkForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formId = document.getElementById('formId').value;
            const purpose = document.getElementById('purpose').value;
            const prefillDataStr = document.getElementById('prefillData').value;
            const expiresIn = document.getElementById('expiresIn').value;
            const maxUses = document.getElementById('maxUses').value;

            let prefillData = null;
            if (prefillDataStr.trim()) {
              try {
                prefillData = JSON.parse(prefillDataStr);
              } catch (err) {
                alert('Invalid JSON in prefill data');
                return;
              }
            }

            const response = await fetch('/forms/' + formId + '/protected-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                purpose,
                prefillData,
                expiresIn: expiresIn ? parseInt(expiresIn) : undefined,
                maxUses: maxUses ? parseInt(maxUses) : undefined,
              }),
            });

            const result = await response.json();
            if (result.success) {
              hideCreateLinkModal();
              await navigator.clipboard.writeText(result.url);
              alert('Protected link created and copied to clipboard!');
            } else {
              alert('Error: ' + (result.error || 'Unknown error'));
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error loading forms:', error);
    return c.html('<p>Error loading forms</p>', 500);
  }
});

/**
 * GET /forms/:id/embed - Iframe-friendly embed page
 */
formsRoutes.get('/:id/embed', async (c) => {
  const id = parseFormId(c);
  if (id === null) {
    return c.html('<p>Invalid form ID</p>', 400);
  }
  const formsService = createGoogleFormsService(c.env.DB);

  try {
    const form = await formsService.getFormIntegration(id);
    if (!form) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Form Not Found</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .error { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #dc2626; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>404 - Form Not Found</h1>
            <p>The requested form integration does not exist.</p>
            <a href="/admin/forms">Back to Forms</a>
          </div>
        </body>
        </html>
      `, 404);
    }

    if (!form.embed_enabled) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Form Disabled</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .error { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #f59e0b; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Form Disabled</h1>
            <p>This form embed is currently disabled.</p>
            <a href="/admin/forms">Back to Forms</a>
          </div>
        </body>
        </html>
      `);
    }

    const embedUrl = formsService.getFormEmbedUrl(form.google_form_id);

    // Track view event
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const ipHash = await formsService.hashIP(ip);
    await formsService.trackEvent(form.id, 'view', { ipHash });

    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Join Our Community | Muslim Space</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; }
          .form-iframe-container {
            position: relative;
            width: 100%;
            min-height: 600px;
            background: white;
            border-radius: 12px;
            overflow: hidden;
          }
          .form-iframe-container iframe {
            width: 100%;
            min-height: 800px;
            border: none;
          }
          .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: #6b7280;
            font-size: 0.875rem;
          }
          .loading.hidden {
            display: none;
          }
          .progress-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #d1d5db;
            transition: background-color 0.3s ease;
          }
          .progress-dot.active {
            background-color: #15803d;
          }
          .brand-gradient {
            background: linear-gradient(135deg, #15803d 0%, #166534 100%);
          }
          .parallax-hero {
            background: linear-gradient(135deg, #15803d 0%, #166534 100%);
            position: relative;
            overflow: hidden;
          }
          .parallax-bg {
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 50%),
                        radial-gradient(circle at 30% 70%, rgba(245, 158, 11, 0.2) 0%, transparent 40%);
            animation: parallaxMove 20s ease-in-out infinite;
            pointer-events: none;
          }
          @keyframes parallaxMove {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            33% { transform: translate(2%, 2%) rotate(2deg); }
            66% { transform: translate(-2%, 1%) rotate(-1deg); }
          }
          .parallax-content { animation: fadeInUp 0.8s ease-out; }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        </style>
      </head>
      <body class="bg-gray-50 min-h-screen">
        <!-- Navbar -->
        <nav class="bg-green-700 text-white">
          <div class="max-w-4xl mx-auto px-4 py-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center font-bold text-green-900">M</div>
              <span class="font-semibold text-lg">Muslim Space</span>
            </div>
          </div>
        </nav>

        <!-- Hero Section -->
        <div class="brand-gradient parallax-hero py-12 px-4 overflow-hidden relative">
          <div class="parallax-bg" aria-hidden="true"></div>
          <div class="max-w-2xl mx-auto text-center parallax-content relative z-10">
            <h1 class="text-3xl sm:text-4xl font-bold text-white mb-3">
              Join Our Community
            </h1>
            <p class="text-green-100 text-lg max-w-2xl mx-auto leading-relaxed">
              Complete this form to register as a volunteer
            </p>
          </div>
        </div>

        <!-- Main Content -->
        <div class="max-w-2xl mx-auto -mt-6 px-4 pb-12">
          <!-- Form Card -->
          <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <!-- Form Header -->
            <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">${form.name}</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">Secure form</span>
                  <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Form Iframe -->
            <div class="form-iframe-container">
              <div id="loading" class="loading">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-green-700" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading form...
              </div>
              <iframe
                id="formFrame"
                src="${embedUrl}"
                title="${form.name}"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                onload="document.getElementById('loading').classList.add('hidden')"
              ></iframe>
            </div>
          </div>

          <!-- Progress indicator (3 steps) -->
          <div class="flex items-center justify-center gap-2 mt-6">
            <div class="w-2 h-2 rounded-full bg-green-600"></div>
            <div class="w-2 h-2 rounded-full bg-gray-300"></div>
            <div class="w-2 h-2 rounded-full bg-gray-300"></div>
          </div>

          <!-- Help Text -->
          <div class="mt-6 text-center">
            <p class="text-sm text-gray-600">
              Having trouble? <a href="mailto:hammad@muslimspace.org" class="text-green-700 hover:text-green-800 font-medium">Contact support</a>
            </p>
          </div>
        </div>

        <!-- Footer -->
        <footer class="py-6 text-center text-gray-500 text-sm">
          <p>Secure form powered by Muslim Space</p>
          <p class="mt-1">Questions? Contact hammad@muslimspace.org</p>
        </footer>

        <!-- Event tracking -->
        <script>
          // Check for submission periodically (Google Forms redirects to thank you page)
          let lastUrl = window.location.href;
          let submitted = false;

          setInterval(() => {
            if (window.location.href !== lastUrl && !submitted) {
              lastUrl = window.location.href;
              // Check if redirected to thank you page
              if (window.location.href.includes('formResponse')) {
                submitted = true;
                trackEvent('submit');
                // Update progress dots to show completion
                document.querySelectorAll('.progress-dot').forEach(dot => {
                  dot.classList.add('active');
                  dot.style.backgroundColor = '#047857';
                });
              }
            }
          }, 1000);

          // Listen for postMessage from Google Forms
          window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'submit' && !submitted) {
              submitted = true;
              trackEvent('submit', event.data);
            }
          });

          async function trackEvent(eventType, data = {}) {
            try {
              await fetch('/forms/${form.id}/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  eventType,
                  responseData: data,
                }),
                keepalive: true,
              });
            } catch (err) {
              console.error('Failed to track event:', err);
            }
          }

          // Track when leaving the page
          window.addEventListener('beforeunload', () => {
            if (!submitted) {
              trackEvent('view');
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error loading form embed:', error);
    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
          .error { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          h1 { color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Error Loading Form</h1>
          <p>An error occurred while loading the form.</p>
        </div>
      </body>
      </html>
    `, 500);
  }
});

/**
 * POST /forms/:id/protected-link - Create a protected link (admin)
 */
formsRoutes.post('/:id/protected-link', requireAuth, async (c) => {
  const id = parseFormId(c);
  if (id === null) {
    return c.json({ success: false, error: 'Invalid form ID' }, 400);
  }
  const user = getCurrentUser(c)!;
  const siteUrl = c.env.SITE_URL || 'https://l.m-space.in';
  const jwtSecret = c.env.JWT_SECRET || 'default-jwt-secret';

  const body = await c.req.json();
  const { purpose, prefillData, expiresIn, maxUses } = body;

  if (!purpose) {
    return c.json({ success: false, error: 'Purpose is required' }, 400);
  }

  try {
    const formsService = createGoogleFormsService(c.env.DB);
    const form = await formsService.getFormIntegration(id);

    if (!form) {
      return c.json({ success: false, error: 'Form not found' }, 404);
    }

    const protectedLinkService = createProtectedLinkService(c.env.DB, jwtSecret);
    const result = await protectedLinkService.createProtectedLink({
      formIntegrationId: id,
      purpose,
      prefillData,
      expiresIn,
      maxUses,
      userId: user.id,
      siteUrl,
    });

    return c.json({
      success: true,
      id: result.id,
      url: result.url,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Error creating protected link:', error);
    return c.json({ success: false, error: 'Failed to create protected link' }, 500);
  }
});

/**
 * GET /forms/protected/:token - Access form via protected link
 */
formsRoutes.get('/protected/:token', async (c) => {
  const token = c.req.param('token');
  const jwtSecret = c.env.JWT_SECRET || 'default-jwt-secret';

  try {
    const protectedLinkService = createProtectedLinkService(c.env.DB, jwtSecret);
    const verification = await protectedLinkService.verifyProtectedLink(token);

    if (!verification.valid) {
      const errorMessages: Record<string, string> = {
        expired: 'This link has expired.',
        limit_reached: 'This link has reached its maximum number of uses.',
        not_found: 'This link is invalid or has been deleted.',
        invalid: 'This link is invalid.',
      };

      const errorMessage = verification.error ? errorMessages[verification.error] || 'Link error' : 'Link error';

      return c.html(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Protected Link Error</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .error { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; }
            h1 { color: #dc2626; margin-bottom: 1rem; }
            p { color: #666; margin-bottom: 1.5rem; }
            a { color: #2563eb; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>🔗 Link Error</h1>
            <p>${errorMessage}</p>
            <a href="/admin/forms">Return to Forms</a>
          </div>
        </body>
        </html>
      `, verification.error === 'not_found' || verification.error === 'invalid' ? 404 : 400);
    }

    const { form, prefillData } = verification;
    const formsService = createGoogleFormsService(c.env.DB);

    // Build prefill URL if data provided
    let formUrl: string;
    if (prefillData && Object.keys(prefillData).length > 0) {
      formUrl = protectedLinkService.buildPrefillUrl(form!.google_form_id, prefillData);
    } else {
      formUrl = formsService.getFormPublicUrl(form!.google_form_id);
    }

    // Track view
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const ipHash = await formsService.hashIP(ip);
    await formsService.trackEvent(form!.id, 'view', { ipHash });

    // Record link usage
    await protectedLinkService.recordUsage(token);

    // Redirect to form
    return c.redirect(formUrl);
  } catch (error) {
    console.error('Error accessing protected link:', error);
    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
          .error { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          h1 { color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Something went wrong</h1>
          <p>An error occurred processing your request.</p>
        </div>
      </body>
      </html>
    `, 500);
  }
});

/**
 * POST /forms/:id/event - Track form submission event
 */
formsRoutes.post('/:id/event', async (c) => {
  const id = parseFormId(c);
  if (id === null) {
    return c.json({ success: false, error: 'Invalid form ID' }, 400);
  }

  try {
    const body = await c.req.json();
    const { eventType, responseData, responderEmail } = body;

    if (!eventType || !['view', 'submit', 'error'].includes(eventType)) {
      return c.json({ success: false, error: 'Invalid event type' }, 400);
    }

    const formsService = createGoogleFormsService(c.env.DB);
    const form = await formsService.getFormIntegration(id);

    if (!form) {
      return c.json({ success: false, error: 'Form not found' }, 404);
    }

    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const ipHash = await formsService.hashIP(ip);

    await formsService.trackEvent(form.id, eventType, {
      responseData,
      responderEmail,
      ipHash,
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Error tracking event:', error);
    return c.json({ success: false, error: 'Failed to track event' }, 500);
  }
});

/**
 * GET /api/forms/:id/responses - Fetch form responses (requires Google creds)
 */
formsRoutes.get('/api/:id/responses', async (c) => {
  const id = parseFormId(c);
  if (id === null) {
    return c.json({ success: false, error: 'Invalid form ID' }, 400);
  }
  const formsService = createGoogleFormsService(c.env.DB);

  try {
    if (!formsService.isGoogleSheetsConfigured()) {
      return c.json({
        success: false,
        error: 'Google Sheets API not configured. Form embed only — sync disabled.',
        syncAvailable: false,
      }, 503);
    }

    const form = await formsService.getFormIntegration(id);
    if (!form) {
      return c.json({ success: false, error: 'Form not found' }, 404);
    }

    const responses = await formsService.getFormResponses(form.google_form_id, form.google_sheet_id || undefined);

    return c.json({
      success: true,
      responses,
    });
  } catch (error) {
    console.error('Error fetching form responses:', error);
    return c.json({ success: false, error: 'Failed to fetch responses' }, 500);
  }
});

/**
 * GET /api/forms - List all forms (for API)
 */
formsRoutes.get('/api', async (c) => {
  const formsService = createGoogleFormsService(c.env.DB);

  try {
    const forms = await formsService.getFormIntegrations();
    return c.json({ success: true, forms });
  } catch (error) {
    console.error('Error fetching forms:', error);
    return c.json({ success: false, error: 'Failed to fetch forms' }, 500);
  }
});

/**
 * GET /api/forms/:id - Get single form details
 */
formsRoutes.get('/api/:id', async (c) => {
  const id = parseFormId(c);
  if (id === null) {
    return c.json({ success: false, error: 'Invalid form ID' }, 400);
  }
  const formsService = createGoogleFormsService(c.env.DB);

  try {
    const form = await formsService.getFormIntegration(id);
    if (!form) {
      return c.json({ success: false, error: 'Form not found' }, 404);
    }

    const stats = await formsService.getFormStats(form.id);

    return c.json({
      success: true,
      form: { ...form, stats },
    });
  } catch (error) {
    console.error('Error fetching form:', error);
    return c.json({ success: false, error: 'Failed to fetch form' }, 500);
  }
});

/**
 * GET /api/forms/:id/events - Get form events
 */
formsRoutes.get('/api/:id/events', async (c) => {
  const id = parseFormId(c);
  if (id === null) {
    return c.json({ success: false, error: 'Invalid form ID' }, 400);
  }
  const eventType = c.req.query('type');
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');

  const formsService = createGoogleFormsService(c.env.DB);

  try {
    const form = await formsService.getFormIntegration(id);
    if (!form) {
      return c.json({ success: false, error: 'Form not found' }, 404);
    }

    const events = await formsService.getFormEvents(form.id, {
      eventType,
      limit,
      offset,
    });

    return c.json({ success: true, events });
  } catch (error) {
    console.error('Error fetching form events:', error);
    return c.json({ success: false, error: 'Failed to fetch events' }, 500);
  }
});
