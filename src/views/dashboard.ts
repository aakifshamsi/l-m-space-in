import type { User, Link } from '../config';
import { renderLayout } from './layout';

export interface DashboardPageProps {
  user: User;
  stats: {
    total_links: number;
    active_links: number;
    total_clicks: number;
  };
  recentLinks: Link[];
  summary: {
    total_clicks: number;
    unique_clicks: number;
    last_clicked: string | null;
    top_referrers: { referrer: string; count: number }[];
    daily_clicks: { date: string; count: number }[];
  };
  enableAds?: boolean;
}

export function renderDashboardPage({ user, stats, recentLinks, summary, enableAds = true }: DashboardPageProps): string {
  const maxDailyClicks = Math.max(...summary.daily_clicks.map(d => d.count), 1);

  return renderLayout({
    title: 'Dashboard - Muslim Space Link',
    user,
    activeNav: 'dashboard',
    enableAds,
    children: `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p class="text-gray-500 mt-1">Welcome back, ${user.name}</p>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="bg-white rounded-lg shadow p-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">Total Links</p>
                <p class="text-3xl font-bold text-gray-900 mt-1">${stats.total_links}</p>
              </div>
              <div class="bg-emerald-100 p-3 rounded-full">
                <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                </svg>
              </div>
            </div>
            <p class="text-sm text-gray-500 mt-2">${stats.active_links} active</p>
          </div>

          <div class="bg-white rounded-lg shadow p-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">Total Clicks</p>
                <p class="text-3xl font-bold text-gray-900 mt-1">${stats.total_clicks.toLocaleString()}</p>
              </div>
              <div class="bg-blue-100 p-3 rounded-full">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
              </div>
            </div>
            <p class="text-sm text-gray-500 mt-2">Last 30 days</p>
          </div>

          <div class="bg-white rounded-lg shadow p-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">Active Links</p>
                <p class="text-3xl font-bold text-gray-900 mt-1">${stats.active_links}</p>
              </div>
              <div class="bg-purple-100 p-3 rounded-full">
                <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
            <p class="text-sm text-gray-500 mt-2">${Math.round((stats.active_links / stats.total_links) * 100) || 0}% of total</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Recent Activity Chart -->
          <div class="bg-white rounded-lg shadow p-5">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Clicks (Last 30 Days)</h2>
            <div class="flex items-end gap-1 h-40">
              ${summary.daily_clicks.map(day => {
                const height = Math.max((day.count / maxDailyClicks) * 100, 2);
                return `
                  <div class="flex-1 bg-emerald-500 rounded-t" style="height: ${height}%" title="${day.date}: ${day.count} clicks"></div>
                `;
              }).join('')}
            </div>
            ${summary.daily_clicks.length === 0 ? '<p class="text-gray-500 text-center py-8">No clicks yet</p>' : ''}
          </div>

          <!-- Top Referrers -->
          <div class="bg-white rounded-lg shadow p-5">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h2>
            ${summary.top_referrers.length > 0 ? `
              <div class="space-y-3">
                ${summary.top_referrers.slice(0, 5).map((ref, idx) => `
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-gray-400 text-sm">${idx + 1}.</span>
                      <span class="text-gray-700 truncate max-w-[200px]">${ref.referrer || 'Direct'}</span>
                    </div>
                    <span class="text-gray-900 font-medium">${ref.count}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-gray-500 text-center py-8">No referrer data</p>'}
          </div>
        </div>

        <!-- Recent Links -->
        <div class="bg-white rounded-lg shadow mt-6">
          <div class="p-6 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Recent Links</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                ${recentLinks.length > 0 ? recentLinks.map(link => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <a href="/${link.slug}" target="_blank" class="text-emerald-600 hover:text-emerald-700 font-mono">
                        ${link.slug}
                      </a>
                    </td>
                    <td class="px-6 py-4">
                      <span class="text-gray-500 truncate max-w-[200px] block">${link.url}</span>
                    </td>
                    <td class="px-6 py-4">
                      <span class="px-2 py-1 text-xs rounded-full ${link.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                        ${link.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-sm">
                      ${new Date(link.created_at).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4">
                      <a href="/admin/links/${link.id}" class="text-emerald-600 hover:text-emerald-700 text-sm">
                        View
                      </a>
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                      No links yet. <a href="/admin/links/new" class="text-emerald-600 hover:text-emerald-700">Create your first link</a>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
  });
}