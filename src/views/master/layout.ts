export interface MasterLayoutProps {
  title?: string;
  children: string;
  user?: { name?: string; email: string; role: string } | null;
  activeNav?: string;
}

export function renderMasterLayout({ title = 'mSpace', children, user, activeNav }: MasterLayoutProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — mSpace</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { colors: { brand: { DEFAULT: '#10b981', dark: '#059669' } } } } }</script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    .nav-link { @apply text-gray-600 hover:text-brand transition-colors text-sm font-medium; }
    .nav-link.active { @apply text-brand; }
  </style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen flex flex-col">

  <header class="bg-white border-b border-gray-200 sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2 font-bold text-lg tracking-tight text-gray-900">
        <span class="text-brand">m</span>Space
      </a>
      <nav class="hidden sm:flex items-center gap-6">
        <a href="/apps" class="nav-link ${activeNav === 'apps' ? 'active' : ''}">Apps</a>
        <a href="/blog" class="nav-link ${activeNav === 'blog' ? 'active' : ''}">Blog</a>
        <a href="/about" class="nav-link ${activeNav === 'about' ? 'active' : ''}">About</a>
        <a href="/volunteers" class="nav-link ${activeNav === 'volunteers' ? 'active' : ''}">Volunteer</a>
      </nav>
      <div class="flex items-center gap-3">
        ${user
          ? `<a href="/u/${user.email}" class="text-sm text-gray-700 hover:text-brand">${user.name || user.email}</a>
             <a href="/admin/logout" class="text-sm text-gray-500 hover:text-red-600">Sign out</a>`
          : `<a href="/join" class="text-sm text-gray-600 hover:text-brand">Sign in</a>
             <a href="/join" class="bg-brand hover:bg-brand-dark text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors">Request invite</a>`
        }
      </div>
    </div>
  </header>

  <main class="flex-1">
    ${children}
  </main>

  <footer class="border-t border-gray-200 bg-white mt-auto">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row justify-between gap-4 text-sm text-gray-500">
      <span>&copy; ${new Date().getFullYear()} mSpace. All rights reserved.</span>
      <div class="flex gap-6">
        <a href="/about" class="hover:text-gray-900">About</a>
        <a href="https://l.m-space.in" class="hover:text-gray-900">Link Shortener</a>
        <a href="/volunteers" class="hover:text-gray-900">Volunteer</a>
      </div>
    </div>
  </footer>

</body>
</html>`;
}
