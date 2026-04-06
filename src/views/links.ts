import type { User, Link, Tag } from '../config';
import { renderLayout } from './layout';
import { renderLinkEditPage } from './link-edit';

export { renderLinkEditPage };

export interface LinksPageProps {
  user: User;
  links: (Link & { tags: Tag[] })[];
  total: number;
  page: number;
  search?: string;
  isActive?: number;
  tags: Tag[];
  enableAds?: boolean;
}

export function renderLinksPage({ user, links, total, page, search, isActive, tags: _tags, enableAds = true }: LinksPageProps): string {
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  return renderLayout({
    title: 'Links - Muslim Space Link',
    user,
    activeNav: 'links',
    enableAds,
    children: `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Links</h1>
            <p class="text-gray-500 mt-1">Manage your short links</p>
          </div>
          <a href="/admin/links/new" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            New Link
          </a>
        </div>

        <!-- Filters -->
        <div class="bg-white rounded-lg shadow mb-6 p-3">
          <form method="GET" class="flex flex-wrap gap-4 items-end">
            <div class="flex-1 min-w-[200px]">
              <label class="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                name="search"
                value="${search || ''}"
                placeholder="Search by URL, title, slug..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="is_active" class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                <option value="">All</option>
                <option value="1" ${isActive === 1 ? 'selected' : ''}>Active</option>
                <option value="0" ${isActive === 0 ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
            <button type="submit" class="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors">
              Filter
            </button>
            <a href="/admin/links" class="text-gray-600 hover:text-gray-900 px-4 py-2">
              Clear
            </a>
          </form>
        </div>

        <!-- Links Table -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Redirect</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                ${links.length > 0 ? links.map(link => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-3">
                      <div class="flex items-center gap-2">
                        <a href="/${link.slug}" target="_blank" class="text-emerald-600 hover:text-emerald-700 font-mono font-medium">
                          ${link.slug}
                        </a>
                        ${link.custom_alias ? `
                          <span class="text-gray-400 text-sm">(${link.custom_alias})</span>
                        ` : ''}
                      </div>
                      ${link.title ? `<div class="text-sm text-gray-500 mt-1">${link.title}</div>` : ''}
                    </td>
                    <td class="px-6 py-3">
                      <span class="text-gray-600 truncate block max-w-[250px]" title="${link.url}">${link.url}</span>
                    </td>
                    <td class="px-6 py-3">
                      <div class="flex flex-wrap gap-1">
                        ${link.tags.length > 0 ? link.tags.map(tag => `
                          <span class="px-2 py-0.5 text-xs rounded-full" style="background-color: ${tag.color}20; color: ${tag.color}">
                            ${tag.name}
                          </span>
                        `).join('') : '<span class="text-gray-400 text-sm">-</span>'}
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <span class="px-2 py-1 text-xs rounded-full ${link.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                        ${link.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-sm">${link.redirect_type}</td>
                    <td class="px-6 py-4 text-gray-500 text-sm">
                      ${new Date(link.created_at).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <a href="/admin/links/${link.id}" class="text-emerald-600 hover:text-emerald-700 text-sm">Stats</a>
                        <a href="/admin/links/${link.id}/edit" class="text-gray-600 hover:text-gray-700 text-sm">Edit</a>
                        ${link.is_active ? `
                          <form method="POST" action="/admin/links/${link.id}/deactivate" class="inline">
                            <button type="submit" class="text-red-600 hover:text-red-700 text-sm">Deactivate</button>
                          </form>
                        ` : `
                          <form method="POST" action="/admin/links/${link.id}/reactivate" class="inline">
                            <button type="submit" class="text-green-600 hover:text-green-700 text-sm">Reactivate</button>
                          </form>
                        `}
                      </div>
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                      No links found
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          ${totalPages > 1 ? `
            <div class="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <div class="text-sm text-gray-500">
                Showing ${(page - 1) * limit + 1} to ${Math.min(page * limit, total)} of ${total} results
              </div>
              <div class="flex gap-2">
                ${page > 1 ? `
                  <a href="?page=${page - 1}&search=${search || ''}&is_active=${isActive !== undefined ? isActive : ''}" class="px-3 py-1 border rounded hover:bg-gray-50">Previous</a>
                ` : ''}
                ${page < totalPages ? `
                  <a href="?page=${page + 1}&search=${search || ''}&is_active=${isActive !== undefined ? isActive : ''}" class="px-3 py-1 border rounded hover:bg-gray-50">Next</a>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `,
  });
}