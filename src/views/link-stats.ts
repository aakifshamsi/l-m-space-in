import type { User, Link, Tag, Click } from '../config';
import { renderLayout } from './layout';

export interface LinkStatsPageProps {
  user: User;
  link: Link & { tags: Tag[] };
  siteUrl: string;
  analytics: {
    total_clicks: number;
    unique_clicks: number;
    last_clicked: string | null;
    clicks_by_date: { date: string; count: number }[];
    clicks_by_referrer: { referrer: string; count: number }[];
    clicks_by_country: { country: string; count: number }[];
  };
  recentClicks: Click[];
  enableAds?: boolean;
}

export function renderLinkStatsPage({ user, link, siteUrl, analytics, recentClicks, enableAds = true }: LinkStatsPageProps): string {
  const fullUrl = `${siteUrl}/${link.slug}`;
  const maxDailyClicks = Math.max(...analytics.clicks_by_date.map(d => d.count), 1);

  return renderLayout({
    title: `Stats: ${link.slug} - Muslim Space Link`,
    user,
    activeNav: 'links',
    enableAds,
    children: `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="mb-6">
          <a href="/admin/links" class="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Links
          </a>
        </div>

        <!-- Link Info -->
        <div class="bg-white rounded-lg shadow mb-6">
          <div class="p-6 border-b border-gray-200">
            <div class="flex justify-between items-start">
              <div>
                <h1 class="text-xl font-bold text-gray-900">${link.title || link.slug}</h1>
                <p class="text-gray-500 mt-1">${link.description || ''}</p>
              </div>
              <div class="flex gap-2">
                <a href="/${link.slug}" target="_blank" class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded text-sm hover:bg-emerald-200">
                  Visit
                </a>
                <a href="/admin/links/${link.id}/edit" class="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
                  Edit
                </a>
                ${link.is_active ? `
                  <form method="POST" action="/admin/links/${link.id}/deactivate">
                    <button type="submit" class="px-3 py-1 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50">
                      Deactivate
                    </button>
                  </form>
                ` : `
                  <form method="POST" action="/admin/links/${link.id}/reactivate">
                    <button type="submit" class="px-3 py-1 border border-green-300 text-green-600 rounded text-sm hover:bg-green-50">
                      Reactivate
                    </button>
                  </form>
                `}
              </div>
            </div>
          </div>
          <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p class="text-sm text-gray-500">Short URL</p>
              <a href="${fullUrl}" target="_blank" class="text-emerald-600 font-mono hover:underline">${fullUrl}</a>
            </div>
            <div>
              <p class="text-sm text-gray-500">Destination</p>
              <a href="${link.url}" target="_blank" class="text-gray-700 truncate block max-w-[300px] hover:underline">${link.url}</a>
            </div>
            <div>
              <p class="text-sm text-gray-500">Status</p>
              <span class="px-2 py-1 text-xs rounded-full ${link.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                ${link.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500">Total Clicks</p>
            <p class="text-3xl font-bold text-gray-900 mt-1">${analytics.total_clicks.toLocaleString()}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500">Unique Clicks</p>
            <p class="text-3xl font-bold text-gray-900 mt-1">${analytics.unique_clicks.toLocaleString()}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500">Last Clicked</p>
            <p class="text-xl font-medium text-gray-900 mt-1">
              ${analytics.last_clicked ? new Date(analytics.last_clicked).toLocaleString() : 'Never'}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Clicks Chart -->
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Clicks Over Time</h2>
            <div class="flex items-end gap-1 h-40">
              ${analytics.clicks_by_date.map(day => {
                const height = Math.max((day.count / maxDailyClicks) * 100, 2);
                return `
                  <div class="flex-1 bg-emerald-500 rounded-t" style="height: ${height}%" title="${day.date}: ${day.count}"></div>
                `;
              }).join('')}
            </div>
            ${analytics.clicks_by_date.length === 0 ? '<p class="text-gray-500 text-center py-8">No clicks yet</p>' : ''}
          </div>

          <!-- Referrers -->
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h2>
            ${analytics.clicks_by_referrer.length > 0 ? `
              <div class="space-y-3">
                ${analytics.clicks_by_referrer.slice(0, 5).map((ref, _idx) => `
                  <div class="flex items-center justify-between">
                    <span class="text-gray-600 truncate max-w-[200px]">${ref.referrer || 'Direct'}</span>
                    <span class="font-medium">${ref.count}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-gray-500 text-center py-8">No referrer data</p>'}
          </div>
        </div>

        <!-- QR Code -->
        <div class="bg-white rounded-lg shadow p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">QR Code</h2>
          <div class="flex items-center gap-6">
            <div class="border-2 border-gray-100 rounded-lg p-2">
              <img src="/qr/${link.slug}" alt="QR Code" class="w-32 h-32">
            </div>
            <div>
              <p class="text-sm text-gray-500 mb-2">Scan or use the URL:</p>
              <code class="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">${fullUrl}</code>
            </div>
          </div>
        </div>

        <!-- Recent Clicks -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Recent Clicks</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referrer</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Agent</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                ${recentClicks.length > 0 ? recentClicks.map(click => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-gray-500 text-sm">
                      ${new Date(click.clicked_at).toLocaleString()}
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-sm">
                      ${click.referrer || 'Direct'}
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-sm">
                      ${click.country || '-'}
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-sm truncate max-w-[200px]">
                      ${click.user_agent || '-'}
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="4" class="px-6 py-8 text-center text-gray-500">
                      No clicks recorded yet
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