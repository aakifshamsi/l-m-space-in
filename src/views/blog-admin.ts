// ===============================================
// Blog Admin View - HTMX Components
// ===============================================

export function blogAdminPage(
  stats: {
    total_submissions: number;
    pending_review: number;
    published_articles: number;
    total_views: number;
  },
  submissions: any[]
) {
  return `
<div class="space-y-6" hx-get="/admin/blog" hx-trigger="reload from:body" hx-swap="innerHTML">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-bold text-gray-900">Blog Moderation</h1>
    <button 
      hx-get="/admin/blog/export" 
      class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
      Export Articles
    </button>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Total Submissions</div>
      <div class="text-2xl font-bold">${stats.total_submissions}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Pending Review</div>
      <div class="text-2xl font-bold text-yellow-600">${stats.pending_review}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Published</div>
      <div class="text-2xl font-bold text-green-600">${stats.published_articles}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Total Views</div>
      <div class="text-2xl font-bold text-blue-600">${stats.total_views.toLocaleString()}</div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="bg-white rounded-lg shadow">
    <div class="border-b">
      <nav class="flex -mb-px">
        <button hx-get="/admin/blog" hx-target="#blog-content"
          class="px-6 py-3 border-b-2 border-primary-500 text-primary-600 font-medium">
          All Articles
        </button>
        <button hx-get="/admin/blog?status=pending" hx-target="#blog-content"
          class="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Pending Review (${stats.pending_review})
        </button>
        <button hx-get="/admin/blog?status=published" hx-target="#blog-content"
          class="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Published
        </button>
      </nav>
    </div>

    <div id="blog-content" class="p-6">
      <!-- Filters -->
      <div class="flex flex-wrap gap-4 mb-4">
        <input type="text" placeholder="Search articles..." 
          class="flex-1 min-w-[200px] px-3 py-2 border rounded-lg"
          hx-get="/admin/blog/search" 
          hx-trigger="keyup delay:300ms" 
          hx-target="#submissions-table-body"
          name="search">
        <select name="category" class="px-3 py-2 border rounded-lg"
          hx-get="/admin/blog/filter" hx-trigger="change" hx-target="#submissions-table-body">
          <option value="">All Categories</option>
          <option value="news">News</option>
          <option value="tutorial">Tutorial</option>
          <option value="story">Story</option>
          <option value="announcement">Announcement</option>
        </select>
      </div>

      <!-- Submissions Table -->
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Article</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Author</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Views</th>
            <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Submitted</th>
            <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody id="submissions-table-body" class="divide-y">
          ${submissions.map(s => blogTableRow(s)).join('')}
          ${submissions.length === 0 ? `
            <tr>
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                No submissions found.
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

export function blogTableRow(submission: any) {
  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    pending: { color: 'text-yellow-800', bg: 'bg-yellow-100', label: 'Pending' },
    approved: { color: 'text-blue-800', bg: 'bg-blue-100', label: 'Approved' },
    published: { color: 'text-green-800', bg: 'bg-green-100', label: 'Published' },
    rejected: { color: 'text-red-800', bg: 'bg-red-100', label: 'Rejected' },
    draft: { color: 'text-gray-800', bg: 'bg-gray-100', label: 'Draft' }
  };
  const status = statusConfig[submission.status] || statusConfig.pending;

  return `
<tr class="hover:bg-gray-50">
  <td class="px-4 py-3">
    <div class="font-medium text-gray-900">${escapeHtml(submission.title)}</div>
    ${submission.category ? `<span class="text-xs px-2 py-0.5 bg-gray-100 rounded">${escapeHtml(submission.category)}</span>` : ''}
  </td>
  <td class="px-4 py-3">
    <div class="text-sm">${escapeHtml(submission.author_name)}</div>
    <div class="text-xs text-gray-500">${escapeHtml(submission.author_email)}</div>
  </td>
  <td class="px-4 py-3">
    <span class="px-2 py-1 text-xs rounded-full ${status.bg} ${status.color}">${status.label}</span>
  </td>
  <td class="px-4 py-3 text-sm">${submission.view_count.toLocaleString()}</td>
  <td class="px-4 py-3 text-sm text-gray-600">
    ${new Date(submission.created_at).toLocaleDateString()}
  </td>
  <td class="px-4 py-3 text-right">
    <div class="flex justify-end gap-2">
      <button 
        hx-get="/admin/blog/${submission.id}/preview" 
        hx-target="#modal-container"
        class="text-blue-600 hover:text-blue-800 text-sm">Preview</button>
      ${submission.status === 'pending' ? `
        <button 
          hx-get="/admin/blog/${submission.id}/review" 
          hx-target="#modal-container"
          class="text-primary-600 hover:text-primary-800 text-sm">Review</button>
      ` : ''}
      ${submission.status === 'approved' ? `
        <button 
          hx-post="/admin/blog/${submission.id}/publish"
          class="text-green-600 hover:text-green-800 text-sm">Publish</button>
      ` : ''}
      ${submission.status === 'published' ? `
        <button 
          hx-post="/admin/blog/${submission.id}/unpublish"
          class="text-gray-600 hover:text-gray-800 text-sm">Unpublish</button>
      ` : ''}
    </div>
  </td>
</tr>
`;
}

export function blogReviewModal(submission: any) {
  return `
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
    <div class="p-6 border-b flex justify-between items-center">
      <h2 class="text-xl font-bold">Review Article</h2>
      <button hx-get="/admin/blog" hx-target="#modal-container" class="text-gray-500 hover:text-gray-700">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <div class="p-6">
      <!-- Article Info -->
      <div class="mb-6">
        <h3 class="text-xl font-semibold">${escapeHtml(submission.title)}</h3>
        <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
          <span>By ${escapeHtml(submission.author_name)}</span>
          <span>|</span>
          <span>${submission.author_email}</span>
          <span>|</span>
          <span>${new Date(submission.created_at).toLocaleDateString()}</span>
        </div>
        ${submission.category ? `
          <span class="inline-block mt-2 px-3 py-1 bg-gray-100 rounded-full text-sm">${escapeHtml(submission.category)}</span>
        ` : ''}
      </div>

      <!-- Content Preview -->
      <div class="border rounded-lg p-4 mb-6 max-h-96 overflow-y-auto">
        <div class="prose prose-sm max-w-none">
          ${submission.content}
        </div>
      </div>

      ${submission.featured_image ? `
        <div class="mb-6">
          <img src="${escapeHtml(submission.featured_image)}" alt="Featured image" class="max-h-48 rounded-lg">
        </div>
      ` : ''}

      <!-- Review Form -->
      <div class="border-t pt-6">
        <h4 class="font-medium mb-4">Your Review</h4>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Review Notes</label>
            <textarea name="review_notes" rows="3" 
              class="w-full px-3 py-2 border rounded-lg"
              placeholder="Optional feedback for the author..."></textarea>
          </div>
          
          <div class="flex items-center mb-4">
            <input type="checkbox" name="publish_now" id="publish_now" value="1" 
              class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
            <label for="publish_now" class="ml-2 text-sm text-gray-700">Publish immediately after approval</label>
          </div>

          <div class="flex gap-3">
            <button hx-post="/admin/blog/${submission.id}/approve"
              hx-vals="js:{review_notes: document.querySelector('textarea[name=review_notes]').value, publish_now: document.querySelector('#publish_now').checked}"
              class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              ✓ Approve
            </button>
            <button hx-post="/admin/blog/${submission.id}/reject"
              hx-vals="js:{review_notes: document.querySelector('textarea[name=review_notes]').value}"
              class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              ✗ Reject
            </button>
            <button hx-get="/admin/blog" hx-target="#modal-container"
              class="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;
}

export function blogPreviewModal(submission: any) {
  return `
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
    <div class="p-6 border-b flex justify-between items-center">
      <div>
        <h2 class="text-xl font-bold">Preview Article</h2>
        <p class="text-sm text-gray-500">${submission.status}</p>
      </div>
      <button hx-get="/admin/blog" hx-target="#modal-container" class="text-gray-500 hover:text-gray-700">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <article class="p-8">
      ${submission.featured_image ? `
        <img src="${escapeHtml(submission.featured_image)}" alt="" class="w-full h-64 object-cover rounded-lg mb-6">
      ` : ''}
      
      <h1 class="text-3xl font-bold text-gray-900 mb-4">${escapeHtml(submission.title)}</h1>
      
      <div class="flex items-center gap-4 text-sm text-gray-500 mb-6 pb-6 border-b">
        <span>By ${escapeHtml(submission.author_name)}</span>
        <span>|</span>
        <span>${new Date(submission.created_at).toLocaleDateString()}</span>
        ${submission.category ? `
          <span class="px-2 py-0.5 bg-gray-100 rounded">${escapeHtml(submission.category)}</span>
        ` : ''}
      </div>
      
      ${submission.excerpt ? `
        <p class="text-lg text-gray-600 mb-6 italic">${escapeHtml(submission.excerpt)}</p>
      ` : ''}
      
      <div class="prose max-w-none">
        ${submission.content}
      </div>

      ${submission.tags?.length ? `
        <div class="mt-8 pt-6 border-t">
          <div class="flex flex-wrap gap-2">
            ${submission.tags.map((t: string) => `<span class="px-3 py-1 bg-gray-100 rounded-full text-sm">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    </article>
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
  blogAdminPage,
  blogTableRow,
  blogReviewModal,
  blogPreviewModal
};
