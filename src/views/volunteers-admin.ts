// ===============================================
// Volunteers Admin View - HTMX Components
// ===============================================

export function volunteersAdminPage(
  stats: {
    total_volunteers: number;
    active_volunteers: number;
    pending_hours_approvals: number;
    total_hours_this_month: number;
  },
  volunteers: any[],
  pendingHours: any[] = []
) {
  return `
<div class="space-y-6" hx-get="/admin/volunteers" hx-trigger="reload from:body" hx-swap="innerHTML">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-bold text-gray-900">Volunteers Dashboard</h1>
    <button 
      hx-get="/admin/volunteers/export" 
      class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
      Export Data
    </button>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Total Volunteers</div>
      <div class="text-2xl font-bold">${stats.total_volunteers}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Active</div>
      <div class="text-2xl font-bold text-green-600">${stats.active_volunteers}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Pending Approvals</div>
      <div class="text-2xl font-bold text-yellow-600">${stats.pending_hours_approvals}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Hours This Month</div>
      <div class="text-2xl font-bold text-blue-600">${stats.total_hours_this_month}</div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="bg-white rounded-lg shadow">
    <div class="border-b">
      <nav class="flex -mb-px">
        <button hx-get="/admin/volunteers" hx-target="#volunteers-content"
          class="px-6 py-3 border-b-2 border-primary-500 text-primary-600 font-medium">
          All Volunteers
        </button>
        <button hx-get="/admin/volunteers/pending" hx-target="#volunteers-content"
          class="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Pending Approvals (${stats.pending_hours_approvals})
        </button>
      </nav>
    </div>

    <div id="volunteers-content" class="p-6">
      <!-- Search -->
      <div class="mb-4">
        <input type="text" placeholder="Search volunteers..." 
          class="w-full md:w-64 px-3 py-2 border rounded-lg"
          hx-get="/admin/volunteers/search" 
          hx-trigger="keyup delay:300ms" 
          hx-target="#volunteers-table-body"
          name="search">
      </div>

      <!-- Volunteers Table -->
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Volunteer</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Skills</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Hours</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Joined</th>
            <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody id="volunteers-table-body" class="divide-y">
          ${volunteers.map(v => volunteersTableRow(v)).join('')}
          ${volunteers.length === 0 ? `
            <tr>
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                No volunteers found.
              </td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    </div>
  </div>
</div>
`;
}

export function volunteersTableRow(volunteer: any) {
  const statusBadge = volunteer.status === 'active' 
    ? '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Active</span>'
    : volunteer.status === 'inactive'
    ? '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Inactive</span>'
    : '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Suspended</span>';

  const skills = volunteer.skills?.slice(0, 3) || [];
  const moreSkills = volunteer.skills?.length > 3 ? `+${volunteer.skills.length - 3}` : '';

  return `
<tr class="hover:bg-gray-50">
  <td class="px-4 py-3">
    <div class="font-medium text-gray-900">${escapeHtml(volunteer.first_name || '')} ${escapeHtml(volunteer.last_name || '')}</div>
    <div class="text-sm text-gray-500">${escapeHtml(volunteer.email)}</div>
  </td>
  <td class="px-4 py-3">
    <div class="flex flex-wrap gap-1">
      ${skills.map((s: string) => `<span class="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">${escapeHtml(s)}</span>`).join('')}
      ${moreSkills ? `<span class="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">${moreSkills}</span>` : ''}
    </div>
  </td>
  <td class="px-4 py-3">
    <div class="font-medium">${volunteer.approved_hours || 0}</div>
    ${volunteer.pending_hours > 0 ? `<div class="text-xs text-yellow-600">${volunteer.pending_hours} pending</div>` : ''}
  </td>
  <td class="px-4 py-3">${statusBadge}</td>
  <td class="px-4 py-3 text-sm text-gray-600">
    ${new Date(volunteer.joined_at).toLocaleDateString()}
  </td>
  <td class="px-4 py-3 text-right">
    <div class="flex justify-end gap-2">
      <button 
        hx-get="/admin/volunteers/${volunteer.id}" 
        hx-target="#modal-container"
        class="text-blue-600 hover:text-blue-800 text-sm">View</button>
      <button 
        hx-get="/admin/volunteers/${volunteer.id}/hours" 
        hx-target="#modal-container"
        class="text-gray-600 hover:text-gray-800 text-sm">Hours</button>
    </div>
  </td>
</tr>
`;
}

export function pendingHoursPanel(pendingHours: any[]) {
  if (pendingHours.length === 0) {
    return `
<div class="text-center py-8 text-gray-500">
  <svg class="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
  <p>No pending hours to approve!</p>
</div>
`;
  }

  return `
<div class="space-y-4">
  <h3 class="font-semibold text-gray-900">Pending Hours Approvals</h3>
  ${pendingHours.map(h => `
    <div class="border rounded-lg p-4 hover:bg-gray-50">
      <div class="flex justify-between items-start">
        <div>
          <div class="font-medium">${escapeHtml(h.volunteer_first_name || '')} ${escapeHtml(h.volunteer_last_name || '')}</div>
          <div class="text-sm text-gray-500">${escapeHtml(h.volunteer_email || '')}</div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold text-primary-600">${h.hours}h</div>
          <div class="text-sm text-gray-500">${h.date}</div>
        </div>
      </div>
      ${h.description ? `<p class="mt-2 text-sm text-gray-600">${escapeHtml(h.description)}</p>` : ''}
      ${h.category ? `<span class="inline-block mt-2 px-2 py-1 text-xs bg-gray-100 rounded">${h.category}</span>` : ''}
      <div class="mt-3 flex justify-end gap-2">
        <button hx-post="/admin/volunteers/hours/${h.id}/reject"
          hx-confirm="Reject these hours?"
          class="px-3 py-1 text-sm border rounded hover:bg-gray-100">Reject</button>
        <button hx-post="/admin/volunteers/hours/${h.id}/approve"
          class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">Approve</button>
      </div>
    </div>
  `).join('')}
</div>
`;
}

export function volunteerDetailModal(volunteer: any, hoursSummary: any, recentHours: any[]) {
  return `
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    <div class="p-6 border-b flex justify-between items-center">
      <h2 class="text-xl font-bold">Volunteer Profile</h2>
      <button hx-get="/admin/volunteers" hx-target="#modal-container" class="text-gray-500 hover:text-gray-700">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <div class="p-6 space-y-6">
      <!-- Profile Info -->
      <div class="flex items-start gap-4">
        <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-2xl font-bold text-primary-600">
          ${(volunteer.first_name?.[0] || 'V').toUpperCase()}
        </div>
        <div>
          <h3 class="text-lg font-semibold">${escapeHtml(volunteer.first_name || '')} ${escapeHtml(volunteer.last_name || '')}</h3>
          <p class="text-gray-500">${escapeHtml(volunteer.email)}</p>
          ${volunteer.phone ? `<p class="text-gray-500">${escapeHtml(volunteer.phone)}</p>` : ''}
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-gray-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-green-600">${hoursSummary?.approved_hours || 0}</div>
          <div class="text-sm text-gray-500">Approved Hours</div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-yellow-600">${hoursSummary?.pending_hours || 0}</div>
          <div class="text-sm text-gray-500">Pending Hours</div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-blue-600">${hoursSummary?.this_month || 0}</div>
          <div class="text-sm text-gray-500">This Month</div>
        </div>
      </div>

      <!-- Skills -->
      ${volunteer.skills?.length ? `
        <div>
          <h4 class="font-medium text-gray-700 mb-2">Skills</h4>
          <div class="flex flex-wrap gap-2">
            ${volunteer.skills.map((s: string) => `<span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">${escapeHtml(s)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Experience Level -->
      <div>
        <h4 class="font-medium text-gray-700 mb-1">Experience Level</h4>
        <span class="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm capitalize">${volunteer.experience_level}</span>
      </div>

      <!-- Recent Hours -->
      <div>
        <h4 class="font-medium text-gray-700 mb-2">Recent Hours</h4>
        ${recentHours.length === 0 ? '<p class="text-gray-500">No hours logged yet.</p>' : `
          <div class="space-y-2">
            ${recentHours.slice(0, 5).map((h: any) => `
              <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <span class="font-medium">${h.hours}h</span>
                  <span class="text-sm text-gray-500 ml-2">${h.date}</span>
                </div>
                <span class="px-2 py-0.5 text-xs rounded ${
                  h.status === 'approved' ? 'bg-green-100 text-green-800' :
                  h.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }">${h.status}</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Notes -->
      ${volunteer.notes ? `
        <div>
          <h4 class="font-medium text-gray-700 mb-1">Notes</h4>
          <p class="text-gray-600">${escapeHtml(volunteer.notes)}</p>
        </div>
      ` : ''}
    </div>

    <div class="p-6 border-t flex justify-between">
      <button hx-post="/admin/volunteers/${volunteer.id}/status"
        hx-vals='{"status": "${volunteer.status === 'active' ? 'inactive' : 'active'}"}'
        class="px-4 py-2 border rounded-lg hover:bg-gray-100">
        ${volunteer.status === 'active' ? 'Deactivate' : 'Activate'}
      </button>
      <button hx-get="/admin/volunteers" hx-target="#modal-container"
        class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
        Close
      </button>
    </div>
  </div>
</div>
`;
}

// Helper function
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export default {
  volunteersAdminPage,
  volunteersTableRow,
  pendingHoursPanel,
  volunteerDetailModal
};
