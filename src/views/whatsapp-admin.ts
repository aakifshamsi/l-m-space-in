// ===============================================
// WhatsApp Admin View - HTMX Components
// ===============================================

export function whatsappAdminPage(
  stats: {
    total_contacts: number;
    opted_in: number;
    messages_sent: number;
    messages_delivered: number;
    delivery_rate: number;
  },
  contacts: any[],
  recentNotifications: any[] = []
) {
  return `
<div class="space-y-6" hx-get="/admin/whatsapp" hx-trigger="reload from:body" hx-swap="innerHTML">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-bold text-gray-900">WhatsApp Broadcast</h1>
    <button 
      hx-get="/admin/whatsapp/new-contact" 
      hx-target="#modal-container"
      class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
      + Add Contact
    </button>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Total Contacts</div>
      <div class="text-2xl font-bold">${stats.total_contacts}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Opted In</div>
      <div class="text-2xl font-bold text-green-600">${stats.opted_in}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Messages Sent</div>
      <div class="text-2xl font-bold text-blue-600">${stats.messages_sent}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Delivered</div>
      <div class="text-2xl font-bold">${stats.messages_delivered}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Delivery Rate</div>
      <div class="text-2xl font-bold">${stats.delivery_rate}%</div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="bg-white rounded-lg shadow">
    <div class="border-b">
      <nav class="flex -mb-px">
        <button hx-get="/admin/whatsapp" hx-target="#whatsapp-content"
          class="px-6 py-3 border-b-2 border-primary-500 text-primary-600 font-medium">
          Send Message
        </button>
        <button hx-get="/admin/whatsapp/contacts" hx-target="#whatsapp-content"
          class="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Contacts (${stats.opted_in})
        </button>
        <button hx-get="/admin/whatsapp/history" hx-target="#whatsapp-content"
          class="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Message History
        </button>
      </nav>
    </div>

    <div id="whatsapp-content" class="p-6">
      <!-- Send Message Form -->
      <div class="max-w-2xl">
        <form hx-post="/admin/whatsapp/send" hx-swap="none" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Recipients</label>
            <select name="recipient_type" id="recipient_type" class="w-full px-3 py-2 border rounded-lg"
              onchange="toggleRecipientFields()">
              <option value="individual">Individual</option>
              <option value="contacts">Selected Contacts</option>
              <option value="all">All Opted-in Contacts</option>
              <option value="tag">By Tag</option>
            </select>
          </div>

          <!-- Individual Phone -->
          <div id="individual-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input type="tel" name="phone" placeholder="+1234567890" 
              class="w-full px-3 py-2 border rounded-lg">
          </div>

          <!-- Contact IDs (hidden by default) -->
          <div id="contacts-field" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1">Select Contacts</label>
            <select name="contact_ids" multiple class="w-full px-3 py-2 border rounded-lg h-32">
              ${contacts.map(c => `<option value="${c.id}">${escapeHtml(c.name || c.phone)} (${c.phone})</option>`).join('')}
            </select>
            <p class="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>

          <!-- Tag selection (hidden by default) -->
          <div id="tag-field" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1">Tag</label>
            <input type="text" name="tag" placeholder="e.g., volunteers, event-attendees" 
              class="w-full px-3 py-2 border rounded-lg">
          </div>

          <!-- Message Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Message Type</label>
            <select name="message_type" class="w-full px-3 py-2 border rounded-lg">
              <option value="text">Text Message</option>
              <option value="template">Template Message</option>
            </select>
          </div>

          <!-- Template Selection -->
          <div id="template-field" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1">Template</label>
            <select name="template_name" class="w-full px-3 py-2 border rounded-lg">
              <option value="event_reminder">Event Reminder</option>
              <option value="volunteer_welcome">Volunteer Welcome</option>
              <option value="blog_notification">Blog Notification</option>
              <option value="general_announcement">General Announcement</option>
            </select>
          </div>

          <!-- Message -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea name="message" rows="4" required
              class="w-full px-3 py-2 border rounded-lg"
              placeholder="Type your message here..."></textarea>
            <p class="text-xs text-gray-500 mt-1">
              <span id="char-count">0</span>/160 characters (recommended for single SMS)
            </p>
          </div>

          <!-- Schedule -->
          <div>
            <label class="flex items-center">
              <input type="checkbox" name="schedule" id="schedule_checkbox" 
                onclick="toggleScheduleField()"
                class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
              <span class="ml-2 text-sm text-gray-700">Schedule for later</span>
            </label>
          </div>

          <div id="schedule-field" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1">Send At</label>
            <input type="datetime-local" name="scheduled_at" 
              class="w-full px-3 py-2 border rounded-lg">
          </div>

          <div class="flex justify-end">
            <button type="submit" class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Send Message
            </button>
          </div>
        </form>

        <!-- Message Templates -->
        <div class="mt-8 pt-6 border-t">
          <h3 class="font-medium text-gray-900 mb-3">Quick Templates</h3>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="useTemplate('event_reminder')"
              class="p-3 border rounded-lg text-left hover:bg-gray-50">
              <div class="font-medium text-sm">Event Reminder</div>
              <div class="text-xs text-gray-500">Remind attendees of upcoming events</div>
            </button>
            <button onclick="useTemplate('volunteer_welcome')"
              class="p-3 border rounded-lg text-left hover:bg-gray-50">
              <div class="font-medium text-sm">Volunteer Welcome</div>
              <div class="text-xs text-gray-500">Welcome new volunteers</div>
            </button>
            <button onclick="useTemplate('announcement')"
              class="p-3 border rounded-lg text-left hover:bg-gray-50">
              <div class="font-medium text-sm">Announcement</div>
              <div class="text-xs text-gray-500">General announcements</div>
            </button>
            <button onclick="useTemplate('survey')"
              class="p-3 border rounded-lg text-left hover:bg-gray-50">
              <div class="font-medium text-sm">Feedback Request</div>
              <div class="text-xs text-gray-500">Request feedback from participants</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
function toggleRecipientFields() {
  const type = document.getElementById('recipient_type').value;
  document.getElementById('individual-field').classList.add('hidden');
  document.getElementById('contacts-field').classList.add('hidden');
  document.getElementById('tag-field').classList.add('hidden');
  
  if (type === 'individual') {
    document.getElementById('individual-field').classList.remove('hidden');
  } else if (type === 'contacts') {
    document.getElementById('contacts-field').classList.remove('hidden');
  } else if (type === 'tag') {
    document.getElementById('tag-field').classList.remove('hidden');
  }
}

function toggleScheduleField() {
  const checked = document.getElementById('schedule_checkbox').checked;
  document.getElementById('schedule-field').classList.toggle('hidden', !checked);
}

function useTemplate(template) {
  const templates = {
    event_reminder: 'Reminder: {{event_title}} is happening on {{event_date}} at {{event_location}}. See you there!',
    volunteer_welcome: 'Welcome to our volunteer program! Thank you for joining us. We\'ll be in touch with opportunities to help.',
    announcement: '📢 {{announcement_title}}\n\n{{announcement_content}}',
    survey: 'Thank you for attending {{event_name}}! Please take a moment to share your feedback: {{survey_link}}'
  };
  document.querySelector('textarea[name=message]').value = templates[template] || '';
  document.querySelector('textarea[name=message]').dispatchEvent(new Event('input'));
}

// Character counter
document.querySelector('textarea[name=message]')?.addEventListener('input', function() {
  document.getElementById('char-count').textContent = this.value.length;
});
</script>
`;
}

export function contactsList(contacts: any[]) {
  return `
<div class="space-y-4">
  <div class="flex justify-between items-center">
    <input type="text" placeholder="Search contacts..." 
      class="w-full md:w-64 px-3 py-2 border rounded-lg"
      hx-get="/admin/whatsapp/contacts/search" 
      hx-trigger="keyup delay:300ms" 
      hx-target="#contacts-list"
      name="search">
    <button hx-get="/admin/whatsapp/new-contact" 
      hx-target="#modal-container"
      class="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
      + Add Contact
    </button>
  </div>

  <table class="w-full">
    <thead class="bg-gray-50">
      <tr>
        <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
        <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Phone</th>
        <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
        <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Tags</th>
        <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Added</th>
        <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
      </tr>
    </thead>
    <tbody id="contacts-list" class="divide-y">
      ${contacts.map(c => contactRow(c)).join('')}
      ${contacts.length === 0 ? `
        <tr>
          <td colspan="6" class="px-4 py-8 text-center text-gray-500">
            No contacts found.
          </td>
        </tr>
      ` : ''}
    </tbody>
  </table>
</div>
`;
}

export function contactRow(contact: any) {
  const statusBadge = contact.opt_in 
    ? '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Opted In</span>'
    : '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Opted Out</span>';

  return `
<tr class="hover:bg-gray-50">
  <td class="px-4 py-3 font-medium">${escapeHtml(contact.name || '—')}</td>
  <td class="px-4 py-3 text-gray-600">${escapeHtml(contact.phone)}</td>
  <td class="px-4 py-3">${statusBadge}</td>
  <td class="px-4 py-3">
    <div class="flex flex-wrap gap-1">
      ${(contact.tags || []).slice(0, 2).map((t: string) => `<span class="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">${escapeHtml(t)}</span>`).join('')}
    </div>
  </td>
  <td class="px-4 py-3 text-sm text-gray-500">${new Date(contact.created_at).toLocaleDateString()}</td>
  <td class="px-4 py-3 text-right">
    <div class="flex justify-end gap-2">
      <button hx-get="/admin/whatsapp/contacts/${contact.id}/edit" 
        hx-target="#modal-container"
        class="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
      <button hx-post="/admin/whatsapp/contacts/${contact.id}/optout"
        class="text-red-600 hover:text-red-800 text-sm">Remove</button>
    </div>
  </td>
</tr>
`;
}

export function messageHistory(notifications: any[]) {
  return `
<div class="space-y-4">
  <table class="w-full">
    <thead class="bg-gray-50">
      <tr>
        <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Recipient</th>
        <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Message</th>
        <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
        <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Sent</th>
        <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
      </tr>
    </thead>
    <tbody class="divide-y">
      ${notifications.map(n => messageRow(n)).join('')}
      ${notifications.length === 0 ? `
        <tr>
          <td colspan="5" class="px-4 py-8 text-center text-gray-500">
            No messages sent yet.
          </td>
        </tr>
      ` : ''}
    </tbody>
  </table>
</div>
`;
}

export function messageRow(notification: any) {
  const statusConfig: Record<string, { color: string; bg: string; icon: string }> = {
    pending: { color: 'text-yellow-800', bg: 'bg-yellow-100', icon: '⏳' },
    sent: { color: 'text-blue-800', bg: 'bg-blue-100', icon: '✓' },
    delivered: { color: 'text-green-800', bg: 'bg-green-100', icon: '✓✓' },
    read: { color: 'text-green-800', bg: 'bg-green-100', icon: '👁' },
    failed: { color: 'text-red-800', bg: 'bg-red-100', icon: '✗' },
    bounced: { color: 'text-red-800', bg: 'bg-red-100', icon: '↩' }
  };
  const status = statusConfig[notification.status] || statusConfig.pending;

  return `
<tr class="hover:bg-gray-50">
  <td class="px-4 py-3">
    <div class="font-medium">${escapeHtml(notification.contact_name || notification.phone)}</div>
    <div class="text-xs text-gray-500">${escapeHtml(notification.phone)}</div>
  </td>
  <td class="px-4 py-3 max-w-xs">
    <div class="truncate text-sm">${escapeHtml(notification.message)}</div>
    ${notification.template_name ? `<span class="text-xs text-gray-500">Template: ${notification.template_name}</span>` : ''}
  </td>
  <td class="px-4 py-3">
    <span class="px-2 py-1 text-xs rounded-full ${status.bg} ${status.color}">
      ${status.icon} ${notification.status}
    </span>
  </td>
  <td class="px-4 py-3 text-sm text-gray-600">
    ${notification.sent_at ? new Date(notification.sent_at).toLocaleString() : '—'}
  </td>
  <td class="px-4 py-3 text-right">
    <button hx-get="/admin/whatsapp/notifications/${notification.id}" 
      hx-target="#modal-container"
      class="text-blue-600 hover:text-blue-800 text-sm">Details</button>
  </td>
</tr>
`;
}

export function addContactModal() {
  return `
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
    <div class="p-6 border-b flex justify-between items-center">
      <h2 class="text-xl font-bold">Add Contact</h2>
      <button hx-get="/admin/whatsapp" hx-target="#modal-container" class="text-gray-500 hover:text-gray-700">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <form hx-post="/admin/whatsapp/contacts" hx-swap="none" class="p-6 space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
        <input type="tel" name="phone" required placeholder="+1234567890" 
          class="w-full px-3 py-2 border rounded-lg">
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input type="text" name="name" placeholder="Contact name" 
          class="w-full px-3 py-2 border rounded-lg">
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input type="email" name="email" placeholder="email@example.com" 
          class="w-full px-3 py-2 border rounded-lg">
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Tags</label>
        <input type="text" name="tags" placeholder="volunteer, event-attendees" 
          class="w-full px-3 py-2 border rounded-lg">
        <p class="text-xs text-gray-500 mt-1">Comma-separated tags</p>
      </div>
      
      <div class="flex justify-end gap-3 pt-4 border-t">
        <button type="button" hx-get="/admin/whatsapp" hx-target="#modal-container"
          class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
        <button type="submit" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          Add Contact
        </button>
      </div>
    </form>
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
  whatsappAdminPage,
  contactsList,
  contactRow,
  messageHistory,
  messageRow,
  addContactModal
};
