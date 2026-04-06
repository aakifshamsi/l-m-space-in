import type { User } from '../config';

export interface BrandingSettings {
  site_name?: string;
  site_tagline?: string;
  site_logo_url?: string;
  site_favicon_url?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface LayoutProps {
  title?: string;
  user?: User | null;
  children: string;
  activeNav?: string;
  branding?: BrandingSettings;
  enableAds?: boolean;
}

export function renderLayout({ title = 'Muslim Space Link', user, children, activeNav, branding = {}, enableAds = true }: LayoutProps): string {
  const siteName = branding.site_name || 'm-space';
  const faviconUrl = branding.site_favicon_url;
  const primaryColor = branding.primary_color || '#10B981';
  const secondaryColor = branding.secondary_color || '#F59E0B';
  const adScript = enableAds ? '<script src="https://quge5.com/88/tag.min.js" data-zone="226801" async data-cfasync="false"></script>' : '';

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', active: activeNav === 'dashboard' },
    { href: '/admin/links', label: 'Links', active: activeNav === 'links' },
    { href: '/admin/tags', label: 'Tags', active: activeNav === 'tags' },
    { href: '/admin/settings', label: 'Settings', active: activeNav === 'settings' },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${siteName}</title>
  ${faviconUrl ? `<link rel="icon" href="${faviconUrl}" type="image/x-icon">` : ''}
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  ${adScript}
  <style>
    :root {
      --primary-color: ${primaryColor};
      --secondary-color: ${secondaryColor};
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .htmx-indicator { opacity: 0; transition: opacity 0.2s; }
    .htmx-request .htmx-indicator { opacity: 1; }
    .htmx-request.htmx-indicator { opacity: 1; }
    .btn-primary { background-color: var(--primary-color); }
    .btn-primary:hover { background-color: color-mix(in srgb, var(--primary-color) 85%, black); }
    .text-primary { color: var(--primary-color); }
    .text-secondary { color: var(--secondary-color); }
    .border-primary { border-color: var(--primary-color); }
    .bg-primary { background-color: var(--primary-color); }
    .focus\:ring-primary:focus { --tw-ring-color: var(--primary-color); }
    .focus\:border-primary:focus { border-color: var(--primary-color); }
    .peer-checked\:bg-primary:peer-checked:bg-emerald-600 { background-color: var(--primary-color); }
  </style>
</head>
<body class="bg-gray-50 min-h-screen flex flex-col">
  ${user ? `
  <nav class="bg-white shadow-sm border-b border-gray-200" style="--tw-border-opacity: 1;">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <a href="/admin/dashboard" class="flex items-center gap-2">
            ${branding.site_logo_url ? `
              <img src="${branding.site_logo_url}" alt="${siteName}" class="h-8 w-auto object-contain">
            ` : `
              <svg class="w-8 h-8" style="color: var(--primary-color)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
              </svg>
            `}
            <span class="text-xl font-bold text-gray-900">${siteName}</span>
          </a>
        </div>
        <div class="flex items-center gap-4">
          <div class="hidden md:flex items-center gap-6">
            ${navItems.map(item => `
              <a href="${item.href}" class="${item.active ? 'font-medium' : 'text-gray-600 hover:text-primary'} transition-colors" style="${item.active ? `color: var(--primary-color)` : ''}">
                ${item.label}
              </a>
            `).join('')}
          </div>
          <div class="flex items-center gap-3 border-l border-gray-200 pl-4">
            <span class="text-sm text-gray-600">${user.name}</span>
            <span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">${user.role}</span>
            <a href="/admin/logout" class="text-sm text-red-600 hover:text-red-700">Logout</a>
          </div>
        </div>
      </div>
    </div>
  </nav>
  <div class="md:hidden bg-white border-b border-gray-200 px-4 py-2 flex gap-4">
    ${navItems.map(item => `
      <a href="${item.href}" class="${item.active ? 'font-medium' : 'text-gray-600'} text-sm" style="${item.active ? `color: var(--primary-color)` : ''}">
        ${item.label}
      </a>
    `).join('')}
  </div>
  ` : ''}
  
  <main class="flex-1">
    ${children}
  </main>

  ${user ? `
  <footer class="bg-white border-t border-gray-200 py-4 mt-auto">
    <div class="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
      &copy; ${new Date().getFullYear()} Muslim Space Link. All rights reserved.
    </div>
  </footer>
  ` : ''}
</body>
</html>`;
}

export function renderLoginLayout(children: string, enableAds: boolean = true): string {
  const adScript = enableAds ? '<script src="https://quge5.com/88/tag.min.js" data-zone="226801" async data-cfasync="false"></script>' : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Muslim Space Link</title>
  <script src="https://cdn.tailwindcss.com"></script>
  ${adScript}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
  ${children}
</body>
</html>`;
}