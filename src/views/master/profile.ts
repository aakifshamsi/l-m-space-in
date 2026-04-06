import { renderMasterLayout } from './layout';

export interface ProfileData {
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  tier: string;
  joined: string;
  link_count: number;
}

export function renderProfilePage(profile: ProfileData, currentUser?: { email: string; role: string } | null): string {
  const name = profile.display_name || profile.handle;
  const initials = name.slice(0, 2).toUpperCase();
  const tierBadge = profile.tier === 'paid'
    ? '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Supporter</span>'
    : profile.tier === 'donor'
    ? '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Donor</span>'
    : '';

  const children = `
    <div class="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div class="bg-white border border-gray-200 rounded-2xl p-8">
        <div class="flex items-start gap-5">
          ${profile.avatar_url
            ? `<img src="${profile.avatar_url}" alt="${name}" class="w-16 h-16 rounded-full object-cover">`
            : `<div class="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-white font-bold text-xl flex-shrink-0">${initials}</div>`
          }
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-xl font-bold text-gray-900 truncate">${name}</h1>
              ${tierBadge}
            </div>
            <p class="text-sm text-gray-400 mt-0.5">@${profile.handle}</p>
            ${profile.bio ? `<p class="text-gray-600 mt-3 text-sm leading-relaxed">${profile.bio}</p>` : ''}
          </div>
        </div>

        <div class="mt-6 pt-6 border-t border-gray-100 flex gap-6 text-sm text-gray-500">
          <span><strong class="text-gray-900">${profile.link_count}</strong> links shared</span>
          <span>Joined ${new Date(profile.joined).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      ${currentUser?.role === 'owner' || currentUser?.role === 'admin' ? `
        <div class="mt-4 text-center">
          <a href="/admin/users" class="text-xs text-gray-400 hover:text-gray-600">Manage in admin →</a>
        </div>
      ` : ''}
    </div>
  `;

  return renderMasterLayout({ title: `@${profile.handle}`, children });
}

export function renderProfileNotFound(): string {
  const children = `
    <div class="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
      <p class="text-4xl mb-4">🙈</p>
      <h1 class="text-xl font-semibold text-gray-900 mb-2">Profile not found</h1>
      <p class="text-gray-500 mb-6">This handle doesn't exist or the profile is private.</p>
      <a href="/" class="text-brand hover:underline text-sm">Back to home</a>
    </div>
  `;
  return renderMasterLayout({ title: 'Not found', children });
}
