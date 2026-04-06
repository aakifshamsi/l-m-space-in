import { renderMasterLayout } from './layout';

interface Stats {
  totalLinks: number;
  activeLinks: number;
  totalUsers: number;
  totalClicks: number;
}

interface Site {
  id: number;
  name: string;
  subdomain: string;
  domain: string;
  status: string;
  plan: string;
  max_links: number;
  enable_ads: number;
}

interface ActivityEntry {
  action: string;
  details: string | null;
  created_at: string;
  user_email?: string;
}

export function renderSuperAdminDashboard(
  stats: Stats,
  sites: Site[],
  activity: ActivityEntry[],
  currentUser: { email: string; role: string }
): string {
  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending_dns: 'bg-amber-100 text-amber-700',
    inactive: 'bg-gray-100 text-gray-500',
    suspended: 'bg-red-100 text-red-700',
  };

  const statCards = [
    { label: 'Total links', value: stats.totalLinks },
    { label: 'Active links', value: stats.activeLinks },
    { label: 'Users', value: stats.totalUsers },
    { label: 'Total clicks', value: stats.totalClicks },
  ];

  const children = `
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Super Admin</h1>
          <p class="text-sm text-gray-500 mt-0.5">Platform control panel — ${currentUser.email}</p>
        </div>
        <div class="flex gap-3">
          <a href="/admin/super/sites/new" class="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ Add site</a>
          <a href="/admin/dashboard" class="border border-gray-300 text-gray-700 hover:border-gray-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors">Link admin →</a>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        ${statCards.map(s => `
          <div class="bg-white border border-gray-200 rounded-xl p-5">
            <div class="text-2xl font-bold text-gray-900">${s.value.toLocaleString()}</div>
            <div class="text-sm text-gray-500 mt-0.5">${s.label}</div>
          </div>
        `).join('')}
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Sites -->
        <div class="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 class="font-semibold text-gray-900">Child sites</h2>
            <a href="/admin/super/sites" class="text-xs text-green-600 hover:underline">Manage →</a>
          </div>
          <table class="w-full text-sm">
            <thead><tr class="text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
              <th class="text-left px-5 py-2.5">Site</th>
              <th class="text-left px-5 py-2.5">Domain</th>
              <th class="text-left px-5 py-2.5">Plan</th>
              <th class="text-left px-5 py-2.5">Status</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
              ${sites.map(site => `
                <tr class="hover:bg-gray-50">
                  <td class="px-5 py-3 font-medium text-gray-900">${site.name}</td>
                  <td class="px-5 py-3 text-gray-500">${site.subdomain}.${site.domain}</td>
                  <td class="px-5 py-3 text-gray-500 capitalize">${site.plan}</td>
                  <td class="px-5 py-3">
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[site.status] || 'bg-gray-100 text-gray-500'}">
                      ${site.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Activity -->
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100">
            <h2 class="font-semibold text-gray-900">Recent activity</h2>
          </div>
          <ul class="divide-y divide-gray-100 text-sm">
            ${activity.length === 0
              ? '<li class="px-5 py-4 text-gray-400">No activity yet</li>'
              : activity.map(a => `
                <li class="px-5 py-3">
                  <div class="text-gray-700 font-medium">${a.action}</div>
                  ${a.details ? `<div class="text-gray-400 text-xs truncate">${a.details}</div>` : ''}
                  <div class="text-gray-400 text-xs mt-0.5">${new Date(a.created_at).toLocaleString()}</div>
                </li>
              `).join('')
            }
          </ul>
        </div>
      </div>
    </div>
  `;

  return renderMasterLayout({ title: 'Super Admin', children, user: currentUser, activeNav: 'super' });
}
