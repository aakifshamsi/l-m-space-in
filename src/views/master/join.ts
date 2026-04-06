import { renderMasterLayout } from './layout';

export function renderJoinPage(opts: { error?: string; code?: string } = {}): string {
  const children = `
    <div class="max-w-md mx-auto px-4 sm:px-6 py-16">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Join mSpace</h1>
        <p class="text-gray-500 text-sm">mSpace is invite-only. Enter your invite code to register.</p>
      </div>

      ${opts.error ? `
        <div class="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          ${opts.error}
        </div>
      ` : ''}

      <div class="bg-white border border-gray-200 rounded-xl p-6">
        <form method="POST" action="/join" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Invite code</label>
            <input type="text" name="code" value="${opts.code || ''}" required
              placeholder="e.g. MSPACE-XXXX"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase tracking-widest">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Your email</label>
            <input type="email" name="email" required
              placeholder="you@example.com"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Display name</label>
            <input type="text" name="display_name" required
              placeholder="Your name"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Handle <span class="text-gray-400">(public @username)</span></label>
            <div class="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent overflow-hidden">
              <span class="px-3 text-gray-400 text-sm bg-gray-50 border-r border-gray-300 py-2">@</span>
              <input type="text" name="handle" required
                placeholder="yourhandle"
                pattern="[a-z0-9_-]{3,30}"
                title="3–30 characters: letters, numbers, _ or -"
                class="flex-1 px-3 py-2 text-sm focus:outline-none">
            </div>
            <p class="text-xs text-gray-400 mt-1">3–30 characters. Letters, numbers, _ or - only.</p>
          </div>
          <button type="submit"
            class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg text-sm transition-colors">
            Create account
          </button>
        </form>
      </div>

      <p class="text-center text-xs text-gray-400 mt-6">
        Already have an account? <a href="/admin/login" class="text-green-600 hover:underline">Sign in</a>
      </p>
    </div>
  `;
  return renderMasterLayout({ title: 'Join', children });
}

export function renderJoinSuccess(handle: string): string {
  const children = `
    <div class="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
      <div class="text-5xl mb-6">🎉</div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Welcome to mSpace!</h1>
      <p class="text-gray-500 mb-6">Your account <strong>@${handle}</strong> is ready. Check your email for a sign-in link.</p>
      <a href="/admin/login" class="inline-block bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors">
        Sign in
      </a>
    </div>
  `;
  return renderMasterLayout({ title: 'Welcome!', children });
}
