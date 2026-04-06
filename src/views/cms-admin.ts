// ===============================================
// CMS Admin Views - Full CMS Backend UI
// ===============================================

// Escape HTML helper
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

// ===============================================
// MAIN CMS DASHBOARD
// ===============================================

export function cmsAdminPage(data: {
  stats: {
    autoBlogPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
    draftPosts: number;
    pages: number;
    pendingSubmissions: number;
    lastGenerated: string | null;
  };
}) {
  return `
<div class="space-y-6">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">CMS Dashboard</h1>
      <p class="text-gray-600">Manage your website content</p>
    </div>
    <div class="flex gap-3">
      <button onclick="showTab('pages')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
        <i class="fas fa-file-alt mr-2"></i> Pages
      </button>
      <button onclick="showTab('blog')" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        <i class="fas fa-blog mr-2"></i> Auto Blog
      </button>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Total Posts</div>
      <div class="text-2xl font-bold text-blue-600">${data.stats.autoBlogPosts}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Published</div>
      <div class="text-2xl font-bold text-green-600">${data.stats.publishedPosts}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Scheduled</div>
      <div class="text-2xl font-bold text-yellow-600">${data.stats.scheduledPosts}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Drafts</div>
      <div class="text-2xl font-bold text-gray-600">${data.stats.draftPosts}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Pages</div>
      <div class="text-2xl font-bold text-purple-600">${data.stats.pages}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Pending Submissions</div>
      <div class="text-2xl font-bold text-orange-600">${data.stats.pendingSubmissions}</div>
    </div>
    <div class="bg-white p-4 rounded-lg shadow col-span-2">
      <div class="text-sm text-gray-500">Last AI Generated</div>
      <div class="text-lg font-medium">${data.stats.lastGenerated ? new Date(data.stats.lastGenerated).toLocaleString() : 'Never'}</div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="bg-white rounded-lg shadow p-6">
    <h2 class="text-lg font-bold mb-4">Quick Actions</h2>
    <div class="flex flex-wrap gap-3">
      <a href="/admin/cms/pages/new" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 inline-flex items-center gap-2">
        <i class="fas fa-plus"></i> New Page
      </a>
      <button hx-post="/admin/cms/blog/auto/generate" hx-target="#generate-result" hx-swap="innerHTML"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2">
        <i class="fas fa-magic"></i> Generate AI Post
      </button>
      <a href="/admin/cms/blog/topics" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 inline-flex items-center gap-2">
        <i class="fas fa-list"></i> Manage Topics
      </a>
      <a href="/admin/cms/settings" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 inline-flex items-center gap-2">
        <i class="fas fa-cog"></i> Settings
      </a>
    </div>
    <div id="generate-result" class="mt-4"></div>
  </div>

  <!-- Recent Activity -->
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-bold">Recent Posts</h2>
      <a href="/admin/cms/blog/auto" class="text-blue-600 hover:text-blue-800 text-sm">View all →</a>
    </div>
    <div id="recent-posts-list" hx-get="/admin/cms/blog/auto" hx-trigger="load" hx-select="#recent-posts" hx-swap="outerHTML">
      <p class="text-gray-500">Loading...</p>
    </div>
  </div>
</div>

<script>
function showTab(tab) {
  document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + tab)?.classList.remove('hidden');
}
</script>
  `;
}

// ===============================================
// PAGE MANAGEMENT
// ===============================================

export function pageList(pages: any[], currentStatus: string) {
  const statusFilters = ['', 'draft', 'published'];
  
  return `
<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h2 class="text-xl font-bold">Pages</h2>
    <a href="/admin/cms/pages/new" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
      <i class="fas fa-plus mr-2"></i> New Page
    </a>
  </div>

  <!-- Filters -->
  <div class="flex gap-2">
    ${statusFilters.map(status => `
      <a href="/admin/cms/pages${status ? '?status=' + status : ''}" 
         class="px-4 py-2 rounded-lg ${currentStatus === status ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
        ${status || 'All'}
      </a>
    `).join('')}
  </div>

  <!-- Pages Table -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Title</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Author</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Updated</th>
          <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y">
        ${pages.length > 0 ? pages.map(page => pageTableRow(page)).join('') : `
          <tr>
            <td colspan="5" class="px-4 py-8 text-center text-gray-500">
              No pages found. <a href="/admin/cms/pages/new" class="text-emerald-600 hover:text-emerald-700">Create your first page</a>
            </td>
          </tr>
        `}
      </tbody>
    </table>
  </div>
</div>
  `;
}

export function pageTableRow(page: any) {
  const statusColor = page.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  
  return `
<tr class="hover:bg-gray-50">
  <td class="px-4 py-3">
    <div class="font-medium text-gray-900">${escapeHtml(page.title)}</div>
    <div class="text-sm text-gray-500">/${escapeHtml(page.slug)}</div>
  </td>
  <td class="px-4 py-3">
    <span class="px-2 py-1 text-xs rounded-full ${statusColor} capitalize">${page.status}</span>
  </td>
  <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(page.author_name) || 'Unknown'}</td>
  <td class="px-4 py-3 text-sm text-gray-600">${new Date(page.updated_at).toLocaleDateString()}</td>
  <td class="px-4 py-3 text-right">
    <div class="flex justify-end gap-2">
      <a href="/admin/cms/pages/${page.id}/edit" class="text-blue-600 hover:text-blue-800 text-sm">Edit</a>
      <button hx-post="/admin/cms/pages/${page.id}/toggle-status" hx-target="closest tr" hx-swap="outerHTML"
        class="text-gray-600 hover:text-gray-800 text-sm">${page.status === 'published' ? 'Unpublish' : 'Publish'}</button>
      <button hx-post="/admin/cms/pages/${page.id}/delete" hx-confirm="Delete this page?" hx-target="closest tr" hx-swap="outerHTML"
        class="text-red-600 hover:text-red-800 text-sm">Delete</button>
    </div>
  </td>
</tr>
  `;
}

export function pageEditor(page: any | null) {
  return `
<div class="max-w-4xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-xl font-bold">${page ? 'Edit Page' : 'New Page'}</h2>
    <a href="/admin/cms/pages" class="text-gray-600 hover:text-gray-800">← Back</a>
  </div>

  <form hx-post="/admin/cms/pages/save" hx-target="#form-result" hx-swap="innerHTML" class="bg-white rounded-lg shadow p-6 space-y-4">
    <input type="hidden" name="id" value="${page?.id || ''}">

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
      <input type="text" name="title" value="${escapeHtml(page?.title || '')}" required
        class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
      <input type="text" name="slug" value="${escapeHtml(page?.slug || '')}"
        placeholder="auto-generated-from-title"
        class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
      <textarea name="excerpt" rows="2"
        class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">${escapeHtml(page?.excerpt || '')}</textarea>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Content</label>
      <textarea name="content" rows="15" id="page-content"
        class="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">${escapeHtml(page?.content || '')}</textarea>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
      <select name="status" class="w-full px-3 py-2 border rounded-lg">
        <option value="draft" ${page?.status === 'draft' || !page ? 'selected' : ''}>Draft</option>
        <option value="published" ${page?.status === 'published' ? 'selected' : ''}>Published</option>
      </select>
    </div>

    <div class="flex gap-4 pt-4">
      <button type="submit" class="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
        ${page ? 'Update Page' : 'Create Page'}
      </button>
      <a href="/admin/cms/pages" class="px-6 py-2 border rounded-lg hover:bg-gray-50">Cancel</a>
    </div>
  </form>
  <div id="form-result" class="mt-4"></div>
</div>
  `;
}

// ===============================================
// AUTO BLOG MANAGEMENT
// ===============================================

export function autoBlogDashboard(data: {
  stats: { total_posts: number; published: number; scheduled: number; drafts: number; last_generated: string | null };
  posts: any[];
  total: number;
  topics: any[];
  aiEnabled: boolean;
  aiConfigured: boolean;
}) {
  return `
<div class="space-y-6">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-xl font-bold">Auto Blog</h2>
      <p class="text-gray-600">AI-powered blog post generation</p>
    </div>
    <div class="flex gap-3">
      <a href="/admin/cms/blog/topics" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
        <i class="fas fa-list mr-2"></i> Topics
      </a>
      <button 
        hx-post="/admin/cms/blog/auto/generate" 
        hx-target="#generate-result" 
        hx-swap="innerHTML"
        ${!data.aiConfigured ? 'disabled class="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"' : 'class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"'}
      >
        <i class="fas fa-magic mr-2"></i> Generate Post
      </button>
    </div>
  </div>

  ${!data.aiConfigured ? `
  <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
    <div class="flex items-center gap-3">
      <i class="fas fa-exclamation-triangle text-yellow-600 text-xl"></i>
      <div>
        <h3 class="font-medium text-yellow-800">AI Not Configured</h3>
        <p class="text-sm text-yellow-700">Please configure AI settings to enable auto blog generation.</p>
      </div>
    </div>
  </div>
  ` : ''}

  <div id="generate-result"></div>

  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-lg shadow">
      <div class="text-sm text-gray-500">Total Posts</div>
      <div class="text-2xl font-bold">${data.stats.total_posts}</div>
    </div>
    <div class="bg-green-50 p-4 rounded-lg">
      <div class="text-sm text-green-600">Published</div>
      <div class="text-2xl font-bold text-green-600">${data.stats.published}</div>
    </div>
    <div class="bg-yellow-50 p-4 rounded-lg">
      <div class="text-sm text-yellow-600">Scheduled</div>
      <div class="text-2xl font-bold text-yellow-600">${data.stats.scheduled}</div>
    </div>
    <div class="bg-gray-50 p-4 rounded-lg">
      <div class="text-sm text-gray-500">Drafts</div>
      <div class="text-2xl font-bold text-gray-600">${data.stats.drafts}</div>
    </div>
  </div>

  <!-- Generate from specific topic -->
  <div class="bg-white rounded-lg shadow p-4">
    <h3 class="font-medium mb-3">Quick Generate from Topic</h3>
    <div class="flex flex-wrap gap-2">
      ${data.topics.slice(0, 6).map(topic => `
        <button 
          hx-post="/admin/cms/blog/auto/generate/${topic.id}" 
          hx-target="#generate-result"
          hx-swap="innerHTML"
          class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200"
        >
          ${escapeHtml(topic.topic.substring(0, 30))}${topic.topic.length > 30 ? '...' : ''}
        </button>
      `).join('')}
      ${data.topics.length === 0 ? '<span class="text-gray-500 text-sm">No topics available</span>' : ''}
    </div>
  </div>

  <!-- Posts List -->
  <div class="bg-white rounded-lg shadow">
    <div class="p-4 border-b flex justify-between items-center">
      <h3 class="font-medium">Generated Posts</h3>
      <span class="text-sm text-gray-500">${data.total} total</span>
    </div>
    <table class="w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Title</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
          <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y">
        ${data.posts.length > 0 ? data.posts.map(post => `
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-900">${escapeHtml(post.title.substring(0, 50))}${post.title.length > 50 ? '...' : ''}</div>
              <div class="text-xs text-gray-500">${escapeHtml(post.slug)}</div>
            </td>
            <td class="px-4 py-3">
              <span class="px-2 py-1 text-xs bg-gray-100 rounded capitalize">${post.category}</span>
            </td>
            <td class="px-4 py-3">
              <span class="px-2 py-1 text-xs rounded-full ${
                post.status === 'published' ? 'bg-green-100 text-green-800' :
                post.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }">${post.status}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
              ${post.published_at ? new Date(post.published_at).toLocaleDateString() : 
                post.created_at ? new Date(post.created_at).toLocaleDateString() : '-'}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex justify-end gap-2">
                <a href="/admin/cms/blog/auto/${post.id}/edit" class="text-blue-600 hover:text-blue-800 text-sm">Edit</a>
                ${post.status === 'published' ? `
                  <button hx-post="/admin/cms/blog/auto/${post.id}/unpublish" hx-target="closest tr" hx-swap="outerHTML" class="text-gray-600 hover:text-gray-800 text-sm">Unpublish</button>
                ` : `
                  <button hx-post="/admin/cms/blog/auto/${post.id}/publish" hx-target="closest tr" hx-swap="outerHTML" class="text-green-600 hover:text-green-800 text-sm">Publish</button>
                `}
                <button hx-post="/admin/cms/blog/auto/${post.id}/regenerate" hx-confirm="Regenerate this post?" hx-target="#generate-result" class="text-purple-600 hover:text-purple-800 text-sm">Regenerate</button>
                <button hx-post="/admin/cms/blog/auto/${post.id}/delete" hx-confirm="Delete this post?" hx-target="closest tr" hx-swap="outerHTML" class="text-red-600 hover:text-red-800 text-sm">Delete</button>
              </div>
            </td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="5" class="px-4 py-8 text-center text-gray-500">
              No posts generated yet. Click "Generate Post" to create your first AI-powered blog post!
            </td>
          </tr>
        `}
      </tbody>
    </table>
  </div>
</div>
  `;
}

export function autoBlogPostEditor(post: any) {
  const categories = ['tutorials', 'product-updates', 'tech-news', 'business', 'marketing', 'general'];
  
  return `
<div class="max-w-4xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-xl font-bold">Edit Generated Post</h2>
    <a href="/admin/cms/blog/auto" class="text-gray-600 hover:text-gray-800">← Back</a>
  </div>

  <form hx-post="/admin/cms/blog/auto/save" hx-target="#form-result" class="bg-white rounded-lg shadow p-6 space-y-4">
    <input type="hidden" name="id" value="${post.id}">

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
      <input type="text" name="title" value="${escapeHtml(post.title)}" required
        class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select name="category" class="w-full px-3 py-2 border rounded-lg">
          ${categories.map(cat => `
            <option value="${cat}" ${post.category === cat ? 'selected' : ''}>${cat}</option>
          `).join('')}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <span class="px-3 py-2 bg-gray-100 rounded-lg capitalize">${post.status}</span>
        ${post.source_topic ? `<span class="text-xs text-gray-500 ml-2">From: ${escapeHtml(post.source_topic)}</span>` : ''}
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
      <textarea name="excerpt" rows="2" class="w-full px-3 py-2 border rounded-lg">${escapeHtml(post.excerpt || '')}</textarea>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Content (HTML)</label>
      <textarea name="content" rows="20" id="post-content"
        class="w-full px-3 py-2 border rounded-lg font-mono text-sm">${escapeHtml(post.content)}</textarea>
    </div>

    <div class="flex gap-4 pt-4">
      <button type="submit" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
      <a href="/admin/cms/blog/auto" class="px-6 py-2 border rounded-lg hover:bg-gray-50">Cancel</a>
    </div>
  </form>
  <div id="form-result" class="mt-4"></div>
</div>
  `;
}

// ===============================================
// BLOG TOPICS MANAGER
// ===============================================

export function blogTopicsManager(topics: any[]) {
  const categories = ['tutorials', 'product-updates', 'tech-news', 'business', 'marketing', 'general'];
  const frequencies = ['daily', 'weekly', 'monthly'];
  
  return `
<div class="space-y-6">
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-xl font-bold">Blog Topics</h2>
      <p class="text-gray-600">Manage topics for AI blog generation</p>
    </div>
    <a href="/admin/cms/blog/auto" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
      <i class="fas fa-arrow-left mr-2"></i> Back to Blog
    </a>
  </div>

  <!-- Add Topic Form -->
  <div class="bg-white rounded-lg shadow p-6">
    <h3 class="font-medium mb-4">Add New Topic</h3>
    <form hx-post="/admin/cms/blog/topics/add" hx-target="#add-result" class="flex gap-4 items-end">
      <div class="flex-1">
        <label class="block text-sm text-gray-600 mb-1">Topic</label>
        <input type="text" name="topic" placeholder="e.g., Best practices for URL shorteners" required
          class="w-full px-3 py-2 border rounded-lg">
      </div>
      <div>
        <label class="block text-sm text-gray-600 mb-1">Category</label>
        <select name="category" class="px-3 py-2 border rounded-lg">
          ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-sm text-gray-600 mb-1">Frequency</label>
        <select name="frequency" class="px-3 py-2 border rounded-lg">
          ${frequencies.map(freq => `<option value="${freq}">${freq}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
        Add Topic
      </button>
    </form>
    <div id="add-result" class="mt-4"></div>
  </div>

  <!-- Topics List -->
  <div class="bg-white rounded-lg shadow">
    <div class="p-4 border-b">
      <h3 class="font-medium">Active Topics (${topics.length})</h3>
    </div>
    <table class="w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Topic</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Frequency</th>
          <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Last Generated</th>
          <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y">
        ${topics.length > 0 ? topics.map(topic => `
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 font-medium">${escapeHtml(topic.topic)}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-1 text-xs bg-gray-100 rounded capitalize">${topic.category}</span>
            </td>
            <td class="px-4 py-3 capitalize text-sm">${topic.frequency}</td>
            <td class="px-4 py-3 text-sm text-gray-600">
              ${topic.last_generated ? new Date(topic.last_generated).toLocaleDateString() : 'Never'}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex justify-end gap-2">
                <button hx-post="/admin/cms/blog/auto/generate/${topic.id}" hx-target="#generate-result"
                  class="text-blue-600 hover:text-blue-800 text-sm">
                  <i class="fas fa-magic mr-1"></i> Generate
                </button>
                <button hx-post="/admin/cms/blog/topics/${topic.id}/delete" hx-confirm="Delete this topic?" 
                  hx-target="closest tr" hx-swap="outerHTML"
                  class="text-red-600 hover:text-red-800 text-sm">Delete</button>
              </div>
            </td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="5" class="px-4 py-8 text-center text-gray-500">
              No active topics. Add some topics above to get started!
            </td>
          </tr>
        `}
      </tbody>
    </table>
  </div>
  <div id="generate-result"></div>
</div>
  `;
}

// ===============================================
// CMS SETTINGS PANEL
// ===============================================

export function cmsSettingsPanel(settings: Record<string, string>) {
  return `
<div class="max-w-2xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-xl font-bold">CMS Settings</h2>
    <a href="/admin/cms" class="text-gray-600 hover:text-gray-800">← Back to Dashboard</a>
  </div>

  <form hx-post="/admin/cms/settings" hx-target="#settings-result" class="bg-white rounded-lg shadow p-6 space-y-6">
    <!-- Site Info -->
    <div>
      <h3 class="font-medium mb-4 pb-2 border-b">Site Information</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
          <input type="text" name="site_name" value="${escapeHtml(settings.site_name || 'M-Space')}"
            class="w-full px-3 py-2 border rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Site Description</label>
          <textarea name="site_description" rows="2"
            class="w-full px-3 py-2 border rounded-lg">${escapeHtml(settings.site_description || '')}</textarea>
        </div>
      </div>
    </div>

    <!-- Auto Blog Settings -->
    <div>
      <h3 class="font-medium mb-4 pb-2 border-b">Auto Blog</h3>
      <div class="space-y-4">
        <div class="flex items-center">
          <input type="checkbox" name="auto_blog_enabled" id="auto_blog_enabled" 
            ${settings.auto_blog_enabled === 'true' ? 'checked' : ''}
            class="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500">
          <label for="auto_blog_enabled" class="ml-2 text-sm text-gray-700">
            Enable auto blog generation
          </label>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Generation Frequency</label>
          <select name="auto_blog_frequency" class="w-full px-3 py-2 border rounded-lg">
            <option value="daily" ${settings.auto_blog_frequency === 'daily' ? 'selected' : ''}>Daily</option>
            <option value="weekly" ${settings.auto_blog_frequency === 'weekly' || !settings.auto_blog_frequency ? 'selected' : ''}>Weekly</option>
            <option value="monthly" ${settings.auto_blog_frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
          </select>
        </div>
      </div>
    </div>

    <button type="submit" class="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
      Save Settings
    </button>
  </form>
  <div id="settings-result" class="mt-4"></div>
</div>
  `;
}

export default {
  cmsAdminPage,
  pageList,
  pageTableRow,
  pageEditor,
  autoBlogDashboard,
  autoBlogPostEditor,
  blogTopicsManager,
  cmsSettingsPanel
};
