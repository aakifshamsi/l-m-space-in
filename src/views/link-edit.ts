import type { User, Link, Tag } from '../config';
import { renderLayout } from './layout';

export interface LinkEditPageProps {
  user: User;
  link: (Link & { tags: Tag[] }) | null;
  tags: Tag[];
  siteUrl: string;
  adFreeDefault?: number;
  error?: string | null;
  enableAds?: boolean;
}

export function renderLinkEditPage({ user, link, tags, siteUrl, adFreeDefault = 0, error, enableAds = true }: LinkEditPageProps): string {
  const isEditing = !!link;
  const isAdmin = user.role === 'owner' || user.role === 'admin';

  return renderLayout({
    title: isEditing ? 'Edit Link - Muslim Space Link' : 'New Link - Muslim Space Link',
    user,
    activeNav: 'links',
    enableAds,
    children: `
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="mb-6">
          <a href="/admin/links" class="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Links
          </a>
        </div>

        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b border-gray-200">
            <h1 class="text-xl font-bold text-gray-900">
              ${isEditing ? 'Edit Link' : 'Create New Link'}
            </h1>
          </div>

          ${error ? `
            <div class="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              ${error}
            </div>
          ` : ''}

          <form method="POST" action="${isEditing ? `/admin/links/${link.id}` : '/admin/links'}" class="p-6 space-y-6">
            <!-- URL -->
            <div>
              <label for="url" class="block text-sm font-medium text-gray-700 mb-1">
                Destination URL <span class="text-red-500">*</span>
              </label>
              <input
                type="url"
                id="url"
                name="url"
                required
                value="${link?.url || ''}"
                placeholder="https://example.com/very-long-url"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
              <p class="text-sm text-gray-500 mt-1">The URL to redirect to</p>
            </div>

            <!-- Slug -->
            <div>
              <label for="slug" class="block text-sm font-medium text-gray-700 mb-1">
                Short Slug
              </label>
              <div class="flex items-center">
                <span class="inline-flex items-center px-3 py-2 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  ${siteUrl}/
                </span>
                <input
                  type="text"
                  id="slug"
                  name="slug"
                  value="${link?.slug || ''}"
                  placeholder="auto-generated"
                  class="flex-1 px-4 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
              </div>
              <p class="text-sm text-gray-500 mt-1">Leave empty for auto-generated slug</p>
            </div>

            <!-- Custom Alias -->
            <div>
              <label for="custom_alias" class="block text-sm font-medium text-gray-700 mb-1">
                Custom Alias
              </label>
              <input
                type="text"
                id="custom_alias"
                name="custom_alias"
                value="${link?.custom_alias || ''}"
                placeholder="my-custom-link"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
              <p class="text-sm text-gray-500 mt-1">Optional custom URL (e.g., l.m-space.in/my-link)</p>
            </div>

            <!-- Title & Description -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value="${link?.title || ''}"
                  placeholder="Link title"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
              </div>
              <div>
                <label for="redirect_type" class="block text-sm font-medium text-gray-700 mb-1">
                  Redirect Type
                </label>
                <select
                  id="redirect_type"
                  name="redirect_type"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="302" ${!link || link.redirect_type === '302' ? 'selected' : ''}>302 (Temporary)</option>
                  <option value="301" ${link?.redirect_type === '301' ? 'selected' : ''}>301 (Permanent)</option>
                </select>
              </div>
            </div>

            <div>
              <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows="2"
                placeholder="Optional description"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >${link?.description || ''}</textarea>
            </div>

            <!-- Expiry & Max Clicks -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="expires_at" class="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="datetime-local"
                  id="expires_at"
                  name="expires_at"
                  value="${link?.expires_at ? link.expires_at.slice(0, 16) : ''}"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
              </div>
              <div>
                <label for="max_clicks" class="block text-sm font-medium text-gray-700 mb-1">
                  Max Clicks
                </label>
                <input
                  type="number"
                  id="max_clicks"
                  name="max_clicks"
                  min="1"
                  value="${link?.max_clicks || ''}"
                  placeholder="No limit"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
              </div>
            </div>

            <!-- Tags -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div class="flex flex-wrap gap-2">
                ${tags.map(tag => `
                  <label class="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="tags"
                      value="${tag.id}"
                      ${link?.tags.some(t => t.id === tag.id) ? 'checked' : ''}
                      class="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    >
                    <span class="ml-2 px-2 py-1 rounded text-sm" style="background-color: ${tag.color}20; color: ${tag.color}">
                      ${tag.name}
                    </span>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Ad-Free Toggle -->
            ${isAdmin ? `
            <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <label class="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="ad_free"
                  value="1"
                  ${(link?.ad_free !== undefined ? link.ad_free : adFreeDefault) ? 'checked' : ''}
                  class="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-5 h-5"
                >
                <span class="ml-3 text-sm font-medium text-gray-700">
                  Ad-free Mode
                </span>
              </label>
              <p class="text-sm text-gray-500 mt-1 ml-8">
                Enable ad-free mode to bypass monetization on this link. ${adFreeDefault ? 'On by default for admins.' : ''}
              </p>
            </div>
            ` : ''}

            <!-- Submit -->
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <a href="/admin/links" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Cancel
              </a>
              <button
                type="submit"
                class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                ${isEditing ? 'Update Link' : 'Create Link'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `,
  });
}