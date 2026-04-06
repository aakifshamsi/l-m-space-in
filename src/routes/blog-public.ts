// ===============================================
// Public Blog Routes - Blog pages for m-space.in
// ===============================================

import { Hono } from 'hono';
import type { Env } from '../config';
import type { D1Database } from '@cloudflare/workers-types';
import { AutoBlogService } from '../services/auto-blog';

export const blogPublicRoutes = new Hono<{ Bindings: Env }>();

// Helper to escape HTML
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

// Blog listing page
blogPublicRoutes.get('/blog', async (c) => {
  const db = c.env.DB as D1Database;
  const autoBlogService = new AutoBlogService(db);
  
  const page = parseInt(c.req.query('page') || '1');
  const category = c.req.query('category') || undefined;
  const pageSize = 10;

  const { posts, total } = await autoBlogService.getPublishedPosts({
    category,
    page,
    pageSize
  });

  const totalPages = Math.ceil(total / pageSize);
  const siteName = 'M-Space';

  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog - ${escapeHtml(siteName)}</title>
  <meta name="description" content="News, tips, and updates from ${escapeHtml(siteName)}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    :root {
      --primary: #059669;
      --primary-dark: #047857;
    }
    .prose h2 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 1rem; }
    .prose p { margin: 1rem 0; line-height: 1.75; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <header class="bg-white shadow-sm sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
      <a href="/" class="text-2xl font-bold text-emerald-600">
        <i class="fas fa-link mr-2"></i>${escapeHtml(siteName)}
      </a>
      <nav class="flex gap-6">
        <a href="/" class="text-gray-600 hover:text-emerald-600 transition-colors">Home</a>
        <a href="/blog" class="text-emerald-600 font-medium">Blog</a>
        <a href="/links" class="text-gray-600 hover:text-emerald-600 transition-colors">Links</a>
      </nav>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-4 py-8">
    <!-- Hero -->
    <div class="text-center mb-12">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">${escapeHtml(siteName)} Blog</h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto">
        News, tips, and insights about link management, URL shortening, and digital productivity.
      </p>
    </div>

    <!-- Categories -->
    <div class="flex flex-wrap justify-center gap-3 mb-8">
      <a href="/blog" class="px-4 py-2 rounded-full ${!category ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} transition-colors">
        All Posts
      </a>
      <a href="/blog?category=tutorials" class="px-4 py-2 rounded-full ${category === 'tutorials' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} transition-colors">
        Tutorials
      </a>
      <a href="/blog?category=product-updates" class="px-4 py-2 rounded-full ${category === 'product-updates' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} transition-colors">
        Updates
      </a>
      <a href="/blog?category=tech-news" class="px-4 py-2 rounded-full ${category === 'tech-news' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} transition-colors">
        Tech News
      </a>
    </div>

    <!-- Blog Posts Grid -->
    ${posts.length > 0 ? `
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${posts.map(post => `
        <article class="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div class="p-6">
            <div class="flex items-center gap-2 mb-3">
              <span class="px-3 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 capitalize">
                ${escapeHtml(post.category)}
              </span>
              <span class="text-sm text-gray-500">
                ${new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h2 class="text-xl font-bold text-gray-900 mb-2 hover:text-emerald-600 transition-colors">
              <a href="/blog/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a>
            </h2>
            <p class="text-gray-600 text-sm mb-4 line-clamp-3">
              ${escapeHtml(post.excerpt)}
            </p>
            <a href="/blog/${escapeHtml(post.slug)}" class="text-emerald-600 font-medium text-sm hover:text-emerald-700 inline-flex items-center gap-1">
              Read more <i class="fas fa-arrow-right text-xs"></i>
            </a>
          </div>
        </article>
      `).join('')}
    </div>

    <!-- Pagination -->
    ${totalPages > 1 ? `
    <div class="flex justify-center gap-2 mt-12">
      ${page > 1 ? `
        <a href="/blog?page=${page - 1}${category ? '&category=' + category : ''}" 
           class="px-4 py-2 bg-white rounded-lg shadow hover:bg-gray-50">
          <i class="fas fa-chevron-left mr-1"></i> Previous
        </a>
      ` : ''}
      <span class="px-4 py-2 bg-emerald-600 text-white rounded-lg">
        Page ${page} of ${totalPages}
      </span>
      ${page < totalPages ? `
        <a href="/blog?page=${page + 1}${category ? '&category=' + category : ''}" 
           class="px-4 py-2 bg-white rounded-lg shadow hover:bg-gray-50">
          Next <i class="fas fa-chevron-right ml-1"></i>
        </a>
      ` : ''}
    </div>
    ` : ''}
    ` : `
    <div class="text-center py-16">
      <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-newspaper text-4xl text-gray-400"></i>
      </div>
      <h2 class="text-2xl font-bold text-gray-900 mb-2">No posts yet</h2>
      <p class="text-gray-600">Check back soon for new content!</p>
    </div>
    `}
  </main>

  <!-- Footer -->
  <footer class="bg-gray-900 text-gray-400 py-8 mt-16">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <div class="flex justify-center gap-6 mb-4">
        <a href="/" class="hover:text-white transition-colors">Home</a>
        <a href="/blog" class="hover:text-white transition-colors">Blog</a>
        <a href="/links" class="hover:text-white transition-colors">Links</a>
      </div>
      <p class="text-sm">&copy; ${new Date().getFullYear()} ${escapeHtml(siteName)}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>
  `);
});

// RSS Feed (MUST be before /:slug to prevent matching "rss.xml" as a slug)
blogPublicRoutes.get('/blog/rss.xml', async (c) => {
  const db = c.env.DB as D1Database;
  const autoBlogService = new AutoBlogService(db);
  
  const { posts } = await autoBlogService.getPublishedPosts({ pageSize: 20 });
  const siteName = 'M-Space';
  
  const blogUrl = 'https://m-space.in/blog';

  const rssItems = posts.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${blogUrl}/${post.slug}</link>
      <guid isPermaLink="true">${blogUrl}/${post.slug}</guid>
      <description><![CDATA[${post.excerpt || post.content.substring(0, 200)}]]></description>
      <pubDate>${new Date(post.published_at || post.created_at).toUTCString()}</pubDate>
      <category>${post.category}</category>
    </item>
  `).join('');

  return c.html(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteName} Blog</title>
    <link>${blogUrl}</link>
    <description>News, tips, and insights about link management and digital productivity.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${blogUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`, 200, {
    'Content-Type': 'application/xml; charset=utf-8'
  });
});

// Single blog post page
blogPublicRoutes.get('/blog/:slug', async (c) => {
  const db = c.env.DB as D1Database;
  const autoBlogService = new AutoBlogService(db);
  
  const slug = c.req.param('slug');
  const post = await autoBlogService.getPostBySlug(slug);

  if (!post || post.status !== 'published') {
    return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Post Not Found - M-Space</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
  <div class="text-center">
    <h1 class="text-6xl font-bold text-emerald-600 mb-4">404</h1>
    <h2 class="text-2xl font-bold text-gray-900 mb-2">Post Not Found</h2>
    <p class="text-gray-600 mb-6">The blog post you're looking for doesn't exist or has been removed.</p>
    <a href="/blog" class="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
      <i class="fas fa-arrow-left"></i> Back to Blog
    </a>
  </div>
</body>
</html>
    `, 404);
  }

  const siteName = 'M-Space';

  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(post.title)} - ${escapeHtml(siteName)} Blog</title>
  <meta name="description" content="${escapeHtml(post.excerpt)}">
  <meta property="og:title" content="${escapeHtml(post.title)}">
  <meta property="og:description" content="${escapeHtml(post.excerpt)}">
  <meta property="og:type" content="article">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    .prose h2 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem; color: #111; }
    .prose p { margin: 1.25rem 0; line-height: 1.8; }
    .prose ul, .prose ol { margin: 1rem 0; padding-left: 1.5rem; }
    .prose li { margin: 0.5rem 0; }
    .prose a { color: #059669; text-decoration: underline; }
    .prose a:hover { color: #047857; }
    .prose blockquote {
      border-left: 4px solid #059669;
      padding-left: 1rem;
      margin: 1.5rem 0;
      font-style: italic;
      color: #4b5563;
    }
    .prose code {
      background: #f3f4f6;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.875em;
    }
    .prose pre {
      background: #1f2937;
      color: #f9fafb;
      padding: 1rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      margin: 1.5rem 0;
    }
    .prose pre code {
      background: transparent;
      padding: 0;
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <header class="bg-white shadow-sm sticky top-0 z-50">
    <div class="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
      <a href="/" class="text-2xl font-bold text-emerald-600">
        <i class="fas fa-link mr-2"></i>${escapeHtml(siteName)}
      </a>
      <nav class="flex gap-6">
        <a href="/" class="text-gray-600 hover:text-emerald-600 transition-colors">Home</a>
        <a href="/blog" class="text-emerald-600 font-medium">Blog</a>
        <a href="/links" class="text-gray-600 hover:text-emerald-600 transition-colors">Links</a>
      </nav>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 py-8">
    <!-- Breadcrumb -->
    <nav class="mb-6">
      <a href="/blog" class="text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-2">
        <i class="fas fa-arrow-left"></i> Back to Blog
      </a>
    </nav>

    <!-- Article -->
    <article class="bg-white rounded-xl shadow-sm">
      <header class="p-8 border-b">
        <div class="flex items-center gap-3 mb-4">
          <span class="px-3 py-1 text-sm font-medium rounded-full bg-emerald-100 text-emerald-700 capitalize">
            ${escapeHtml(post.category)}
          </span>
          <span class="text-gray-500 text-sm">
            ${new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          ${escapeHtml(post.title)}
        </h1>
        ${post.excerpt ? `
        <p class="text-xl text-gray-600 leading-relaxed">
          ${escapeHtml(post.excerpt)}
        </p>
        ` : ''}
      </header>

      <div class="p-8">
        <div class="prose max-w-none">
          ${post.content}
        </div>

        <!-- Share buttons -->
        <div class="mt-12 pt-8 border-t">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Share this article</h3>
          <div class="flex gap-4">
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent('https://m-space.in/blog/' + post.slug)}" 
               target="_blank" rel="noopener noreferrer"
               class="w-10 h-10 bg-blue-400 text-white rounded-full flex items-center justify-center hover:bg-blue-500 transition-colors">
              <i class="fab fa-twitter"></i>
            </a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://m-space.in/blog/' + post.slug)}" 
               target="_blank" rel="noopener noreferrer"
               class="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
              <i class="fab fa-facebook-f"></i>
            </a>
            <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent('https://m-space.in/blog/' + post.slug)}&title=${encodeURIComponent(post.title)}" 
               target="_blank" rel="noopener noreferrer"
               class="w-10 h-10 bg-blue-700 text-white rounded-full flex items-center justify-center hover:bg-blue-800 transition-colors">
              <i class="fab fa-linkedin-in"></i>
            </a>
          </div>
        </div>
      </div>
    </article>

    <!-- Related posts placeholder -->
    <div class="mt-8">
      <a href="/blog" class="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium">
        <i class="fas fa-arrow-left"></i> Read more articles
      </a>
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-gray-900 text-gray-400 py-8 mt-16">
    <div class="max-w-4xl mx-auto px-4 text-center">
      <div class="flex justify-center gap-6 mb-4">
        <a href="/" class="hover:text-white transition-colors">Home</a>
        <a href="/blog" class="hover:text-white transition-colors">Blog</a>
        <a href="/links" class="hover:text-white transition-colors">Links</a>
      </div>
      <p class="text-sm">&copy; ${new Date().getFullYear()} ${escapeHtml(siteName)}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>
  `);
});

export default blogPublicRoutes;
