// ===============================================
// Events Admin View - HTMX Components
// ===============================================

export function eventsAdminPage(stats: {
  total_events: number;
  upcoming_events: number;
  active_registrations: number;
  total_attendees: number;
}, events: any[], registrations: any[] = []) {
  return `
<div class="space-y-6" hx-get="/admin/events" hx-trigger="reload from:body" hx-swap="innerHTML">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-bold text-gray-900">Events Management</h1>
    <button 
      hx-get="/admin/events/new" 
      hx-target="#modal-container"
      hx-swap="innerHTML"
      class="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
      + Create Event
    </button>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Total Events</div>
      <div class="text-2xl font-bold">${stats.total_events}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Upcoming</div>
      <div class="text-2xl font-bold text-green-600">${stats.upcoming_events}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Active Registrations</div>
      <div class="text-2xl font-bold text-blue-600">${stats.active_registrations}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Total Attendees</div>
      <div class="text-2xl font-bold">${stats.total_attendees}</div>
    </div>
  </div>

  <!-- Events Table -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <div class="p-4 border-b">
      <input 
        type="text" 
        placeholder="Search events..." 
        class="w-full md:w-64 px-3 py-2 border rounded-lg"
        hx-get="/admin/events/search" 
        hx-trigger="keyup delay:300ms" 
        hx-target="#events-table-body"
        name="search">
    </div>
    <table class="w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Event</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Registrations</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
          <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
        </tr>
      </thead>
      <tbody id="events-table-body" class="divide-y">
        ${events.map(event => eventsTableRow(event)).join('')}
        ${events.length === 0 ? `
          <tr>
            <td colspan="5" class="px-4 py-8 text-center text-gray-500">
              No events found. Create your first event!
            </td>
          </tr>
        ` : ''}
      </tbody>
    </table>
  </div>
</div>
`;
}

export function eventsTableRow(event: any) {
  const statusBadge = event.registration_open 
    ? '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Open</span>'
    : '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Closed</span>';

  return `
<tr class="hover:bg-gray-50">
  <td class="px-4 py-3">
    <div class="font-medium text-gray-900">${escapeHtml(event.title)}</div>
    <div class="text-sm text-gray-500">${event.location || 'No location'}</div>
  </td>
  <td class="px-4 py-3 text-sm text-gray-600">
    ${event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBD'}
  </td>
  <td class="px-4 py-3">
    <span class="font-medium">${event.registration_count || 0}</span>
    ${event.max_attendees ? `<span class="text-gray-400">/${event.max_attendees}</span>` : ''}
  </td>
  <td class="px-4 py-3">${statusBadge}</td>
  <td class="px-4 py-3 text-right">
    <div class="flex justify-end gap-2">
      <button 
        hx-get="/admin/events/${event.id}/edit" 
        hx-target="#modal-container"
        class="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
      <button 
        hx-get="/admin/events/${event.id}/registrations" 
        hx-target="#modal-container"
        class="text-gray-600 hover:text-gray-800 text-sm">View RSVPs</button>
      <button 
        hx-delete="/admin/events/${event.id}"
        hx-confirm="Are you sure you want to delete this event?"
        hx-swap="none"
        class="text-red-600 hover:text-red-800 text-sm">Delete</button>
    </div>
  </td>
</tr>
`;
}

export function eventFormModal(event?: any) {
  const isEdit = !!event?.id;
  return `
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    <div class="p-6 border-b flex justify-between items-center">
      <h2 class="text-xl font-bold">${isEdit ? 'Edit Event' : 'Create Event'}</h2>
      <button hx-get="/admin/events" hx-target="#modal-container" class="text-gray-500 hover:text-gray-700">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <form hx-post="/admin/events${isEdit ? `/${event.id}` : ''}" hx-swap="none" class="p-6 space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
        <input type="text" name="title" value="${event?.title || ''}" required 
          class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500">
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea name="description" rows="4" 
          class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500">${event?.description || ''}</textarea>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
          <input type="datetime-local" name="event_date" value="${event?.event_date?.slice(0, 16) || ''}" 
            class="w-full px-3 py-2 border rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
          <input type="datetime-local" name="end_date" value="${event?.end_date?.slice(0, 16) || ''}" 
            class="w-full px-3 py-2 border rounded-lg">
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input type="text" name="location" value="${event?.location || ''}" 
            class="w-full px-3 py-2 border rounded-lg" placeholder="Venue name or address">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Location URL</label>
          <input type="url" name="location_url" value="${event?.location_url || ''}" 
            class="w-full px-3 py-2 border rounded-lg" placeholder="https://...">
        </div>
      </div>
      
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Max Attendees</label>
          <input type="number" name="max_attendees" value="${event?.max_attendees || ''}" min="0" 
            class="w-full px-3 py-2 border rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Cost ($)</label>
          <input type="number" name="cost" value="${event?.cost || 0}" min="0" step="0.01" 
            class="w-full px-3 py-2 border rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Registration Deadline</label>
          <input type="datetime-local" name="registration_deadline" 
            value="${event?.registration_deadline?.slice(0, 16) || ''}" 
            class="w-full px-3 py-2 border rounded-lg">
        </div>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
        <input type="url" name="image_url" value="${event?.image_url || ''}" 
          class="w-full px-3 py-2 border rounded-lg" placeholder="https://...">
      </div>
      
      <div class="flex items-center">
        <input type="checkbox" name="registration_open" id="registration_open" value="1" 
          ${event?.registration_open !== 0 ? 'checked' : ''} 
          class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
        <label for="registration_open" class="ml-2 text-sm text-gray-700">Registration Open</label>
      </div>
      
      <div class="flex justify-end gap-3 pt-4 border-t">
        <button type="button" hx-get="/admin/events" hx-target="#modal-container"
          class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
        <button type="submit" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          ${isEdit ? 'Update Event' : 'Create Event'}
        </button>
      </div>
    </form>
  </div>
</div>
`;
}

export function eventRegistrationsModal(event: any, registrations: any[]) {
  return `
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
    <div class="p-6 border-b flex justify-between items-center">
      <div>
        <h2 class="text-xl font-bold">${escapeHtml(event.title)}</h2>
        <p class="text-sm text-gray-500">${event.registration_count || 0} registrations</p>
      </div>
      <button hx-get="/admin/events" hx-target="#modal-container" class="text-gray-500 hover:text-gray-700">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <div class="p-6">
      ${registrations.length === 0 ? `
        <p class="text-center text-gray-500 py-8">No registrations yet.</p>
      ` : `
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-2 text-left text-sm">Name</th>
              <th class="px-4 py-2 text-left text-sm">Email</th>
              <th class="px-4 py-2 text-left text-sm">Phone</th>
              <th class="px-4 py-2 text-left text-sm">Status</th>
              <th class="px-4 py-2 text-left text-sm">Registered</th>
              <th class="px-4 py-2 text-right text-sm">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${registrations.map(reg => `
              <tr>
                <td class="px-4 py-2">${escapeHtml(reg.first_name || '')} ${escapeHtml(reg.last_name || '')}</td>
                <td class="px-4 py-2">${escapeHtml(reg.email)}</td>
                <td class="px-4 py-2">${reg.phone ? escapeHtml(reg.phone) : '-'}</td>
                <td class="px-4 py-2">
                  <select hx-patch="/admin/events/${event.id}/registrations/${reg.id}"
                    hx-trigger="change" hx-swap="none"
                    class="text-sm border rounded px-2 py-1">
                    <option value="registered" ${reg.status === 'registered' ? 'selected' : ''}>Registered</option>
                    <option value="attended" ${reg.status === 'attended' ? 'selected' : ''}>Attended</option>
                    <option value="cancelled" ${reg.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    <option value="no_show" ${reg.status === 'no_show' ? 'selected' : ''}>No Show</option>
                  </select>
                </td>
                <td class="px-4 py-2 text-sm text-gray-500">
                  ${new Date(reg.registered_at).toLocaleDateString()}
                </td>
                <td class="px-4 py-2 text-right">
                  <button hx-post="/admin/events/${event.id}/notify"
                    hx-vals='{"email": "${reg.email}"}'
                    class="text-blue-600 hover:text-blue-800 text-sm">Send Reminder</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="mt-4 pt-4 border-t flex justify-between items-center">
          <div class="text-sm text-gray-500">
            Export: 
            <button class="text-blue-600 hover:underline ml-1">CSV</button> |
            <button class="text-blue-600 hover:underline">Excel</button>
          </div>
          <button hx-post="/admin/events/${event.id}/send-reminders"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Send Reminders to All
          </button>
        </div>
      `}
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
  eventsAdminPage,
  eventsTableRow,
  eventFormModal,
  eventRegistrationsModal
};
