import type { BrandingSettings } from './layout';

export interface LoginPageProps {
  redirect?: string;
  error?: string | null;
  branding?: BrandingSettings;
  magicLinkMessage?: string | null;
  enableAds?: boolean;
}

export function renderLoginPage({ redirect = '/admin/dashboard', error, branding = {}, magicLinkMessage = null, enableAds = true }: LoginPageProps): string {
  const siteName = branding.site_name || 'm-space';
  const siteTagline = branding.site_tagline || 'Sign in to your account';
  const logoUrl = branding.site_logo_url;
  const faviconUrl = branding.site_favicon_url;
  const primaryColor = branding.primary_color || '#10B981';
  const secondaryColor = branding.secondary_color || '#F59E0B';
  const adScript = enableAds ? '<script src="https://quge5.com/88/tag.min.js" data-zone="226801" async data-cfasync="false"></script>' : '';

  const content = `
    <style>
      :root {
        --primary-color: ${primaryColor};
        --secondary-color: ${secondaryColor};
      }
      .tab-btn {
        padding: 0.75rem 1.5rem;
        font-weight: 500;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
        cursor: pointer;
      }
      .tab-btn.active {
        border-bottom-color: var(--primary-color);
        color: var(--primary-color);
      }
      .tab-btn:not(.active) {
        color: #6b7280;
      }
      .tab-btn:not(.active):hover {
        color: #374151;
      }
      .tab-content {
        display: none;
      }
      .tab-content.active {
        display: block;
      }
    </style>
    <div class="w-full max-w-md">
      <div class="bg-white rounded-lg shadow-lg p-8">
        <div class="text-center mb-8">
          ${logoUrl ? `
            <img src="${logoUrl}" alt="${siteName}" class="h-16 mx-auto object-contain mb-4">
          ` : `
            <svg class="w-16 h-16 mx-auto" style="color: var(--primary-color)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
            </svg>
          `}
          <h1 class="text-2xl font-bold mt-4 text-gray-900">${siteName}</h1>
          ${siteTagline ? `<p class="text-gray-500 mt-1">${siteTagline}</p>` : ''}
        </div>

        ${error ? `
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            ${error}
          </div>
        ` : ''}

        ${magicLinkMessage ? `
          <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            ${magicLinkMessage}
          </div>
        ` : ''}

        <!-- Tab Navigation -->
        <div class="flex border-b border-gray-200 mb-6">
          <button type="button" class="tab-btn active" onclick="switchTab('password')">
            Password
          </button>
          <button type="button" class="tab-btn" onclick="switchTab('magic-link')">
            Magic Link
          </button>
        </div>

        <!-- Password Login Form -->
        <div id="password-tab" class="tab-content active">
          <form method="POST" action="/admin/login" class="space-y-6">
            <input type="hidden" name="redirect" value="${redirect}">
            
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-emerald-500 transition-colors"
                style="--tw-ring-color: var(--primary-color); border-color: var(--primary-color);"
                placeholder="you@example.com"
              >
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-emerald-500 transition-colors"
                style="--tw-ring-color: var(--primary-color); border-color: var(--primary-color);"
                placeholder="••••••••"
              >
            </div>

            <button
              type="submit"
              class="w-full text-white py-2 px-4 rounded-lg focus:ring-2 focus:ring-offset-2 transition-colors font-medium"
              style="background-color: var(--primary-color); --tw-ring-color: var(--primary-color);"
            >
              Sign In
            </button>
          </form>
        </div>

        <!-- Magic Link Login Form -->
        <div id="magic-link-tab" class="tab-content">
          <form method="POST" action="/admin/magic-link/request" class="space-y-6">
            <input type="hidden" name="redirect" value="${redirect}">
            
            <p class="text-sm text-gray-600 mb-4">
              Enter your email and we'll send you a secure sign-in link. No password needed!
            </p>

            <div>
              <label for="magic-email" class="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="magic-email"
                name="email"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-emerald-500 transition-colors"
                style="--tw-ring-color: var(--primary-color); border-color: var(--primary-color);"
                placeholder="you@example.com"
              >
            </div>

            <button
              type="submit"
              class="w-full text-white py-2 px-4 rounded-lg focus:ring-2 focus:ring-offset-2 transition-colors font-medium"
              style="background-color: var(--primary-color); --tw-ring-color: var(--primary-color);"
            >
              Send Me a Link
            </button>
          </form>
        </div>

        <div class="mt-6 text-center text-sm text-gray-500">
          <p>Default credentials (change on first login):</p>
          <p class="mt-1">Owner: hammad@example.com / owner123</p>
          <p>Admin: aakif@sham.si / admin123</p>
        </div>
      </div>
    </div>

    <script>
      function switchTab(tabName) {
        // Remove active from all tabs
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Activate selected tab
        document.querySelector(\`[onclick="switchTab('\${tabName}')"]\`).classList.add('active');
        document.getElementById(\`\${tabName}-tab\`).classList.add('active');
      }
    </script>
  `;

  // Update renderLoginLayout to accept branding
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - ${siteName}</title>
  ${faviconUrl ? `<link rel="icon" href="${faviconUrl}" type="image/x-icon">` : ''}
  <script src="https://cdn.tailwindcss.com"></script>
  ${adScript}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
  ${content}
</body>
</html>`;
}