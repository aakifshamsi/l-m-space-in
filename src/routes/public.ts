import { Hono } from 'hono';
import type { Env, AppConfig } from '../config';
import { createDbHelper } from '../db';
import { createLinksService } from '../services/links';
import { createAnalyticsService } from '../services/analytics';
import { createAuthService } from '../services/auth';

export const publicRoutes = new Hono<{ Bindings: Env }>();

// Root path handler - show beautiful public landing page
publicRoutes.get('/', (c) => {
  const landingPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>m-space | Free URL Shortener</title>
  <meta name="description" content="Free URL shortener by m-space. Create short, memorable links in seconds.">
  <link rel="stylesheet" href="/style.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
    
    * {
      font-family: 'Poppins', sans-serif;
    }
    
    /* Islamic Geometric Pattern Background */
    .geometric-bg {
      background-color: #f8fafc;
      background-image: 
        radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.06) 0%, transparent 50%),
        radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.03) 0%, transparent 70%);
    }
    
    /* Crescent Moon Icon */
    .crescent {
      position: relative;
      display: inline-block;
      width: 24px;
      height: 24px;
    }
    .crescent::before {
      content: '☪';
      font-size: 1.5rem;
      color: #10b981;
    }
    
    /* Star Icon */
    .star {
      position: relative;
      display: inline-block;
    }
    .star::before {
      content: '✦';
      font-size: 1rem;
      color: #f59e0b;
    }
    
    /* Floating Animation */
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    .float-animation {
      animation: float 6s ease-in-out infinite;
    }
    
    /* Pulse Animation for Button */
    @keyframes pulse-ring {
      0% { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    .pulse-btn:active {
      animation: pulse-ring 0.3s ease-out;
    }
    
    /* Result Card Animation */
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .slide-up {
      animation: slideUp 0.4s ease-out forwards;
    }
    
    /* Loading Spinner */
    .spinner {
      border: 3px solid #e5e7eb;
      border-top: 3px solid #10b981;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Focus styles */
    .input-glow:focus {
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
    }
    
    /* Custom scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
    }
    ::-webkit-scrollbar-track {
      background: #f1f5f9;
    }
    ::-webkit-scrollbar-thumb {
      background: #10b981;
      border-radius: 4px;
    }
  </style>
</head>
<body class="geometric-bg min-h-screen flex flex-col">
  <!-- Header -->
  <header class="py-6 px-4">
    <div class="max-w-4xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
          <span class="text-white text-xl">✦</span>
        </div>
        <span class="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
          m-space
        </span>
      </div>
      <nav class="flex items-center gap-4">
        <a href="/admin" class="text-gray-600 hover:text-emerald-600 transition-colors font-medium">
          Dashboard
        </a>
      </nav>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-grow flex items-center justify-center px-4 py-8">
    <div class="max-w-2xl w-full">
      <!-- Hero Section -->
      <div class="text-center mb-10">
        <div class="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span class="star"></span>
          Free & Fast URL Shortener
          <span class="crescent"></span>
        </div>
        <h1 class="text-4xl md:text-5xl font-extrabold text-gray-800 mb-4 leading-tight">
          Shorten Your Links
          <span class="block text-emerald-600">Share With Ease</span>
        </h1>
        <p class="text-gray-500 text-lg max-w-md mx-auto">
          Transform long URLs into short, memorable links. No signup required.
        </p>
      </div>

      <!-- URL Shortener Form -->
      <div class="bg-white rounded-2xl shadow-xl shadow-emerald-900/5 p-6 md:p-8 mb-8">
        <form id="shortenForm" class="space-y-4">
          <div class="flex flex-col md:flex-row gap-3">
            <div class="flex-grow relative">
              <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <input 
                type="url" 
                id="urlInput" 
                name="url" 
                placeholder="Paste your long URL here..." 
                required
                class="input-glow w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:border-emerald-500 focus:outline-none transition-all text-lg"
              >
            </div>
            <button 
              type="submit" 
              id="submitBtn"
              class="pulse-btn px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-600/40 transition-all duration-200 flex items-center justify-center gap-2 min-w-[140px]"
            >
              <span id="btnText">Shorten</span>
              <span id="btnSpinner" class="spinner hidden"></span>
              <svg id="btnArrow" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </form>
        
        <!-- Error Message -->
        <div id="errorMsg" class="hidden mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span id="errorText"></span>
        </div>
      </div>

      <!-- Result Section (Hidden by default) -->
      <div id="resultSection" class="hidden">
        <div class="slide-up bg-white rounded-2xl shadow-xl shadow-emerald-900/5 p-6 md:p-8">
          <div class="flex items-center gap-2 mb-6">
            <div class="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span class="text-emerald-700 font-semibold">Link Created Successfully!</span>
          </div>
          
          <!-- Short URL Display -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-500 mb-2">Your Short URL</label>
            <div class="flex items-center gap-2">
              <input 
                type="text" 
                id="shortUrl" 
                readonly
                class="flex-grow px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 font-medium text-lg"
              >
              <button 
                id="copyBtn"
                class="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 transition-all flex items-center gap-2"
              >
                <svg id="copyIcon" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span id="copyText">Copy</span>
              </button>
            </div>
          </div>
          
          <!-- QR Code Section -->
          <div class="border-t border-gray-100 pt-6">
            <label class="block text-sm font-medium text-gray-500 mb-4 text-center">QR Code</label>
            <div class="flex justify-center">
              <div class="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-inner">
                <img id="qrCode" src="" alt="QR Code" class="w-48 h-48">
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <a 
              id="visitLink"
              href="#" 
              target="_blank"
              class="px-6 py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold rounded-xl transition-all text-center flex items-center justify-center gap-2"
            >
              Visit Link
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <button 
              id="newLinkBtn"
              class="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Shorten Another
            </button>
          </div>
        </div>
      </div>

      <!-- Features Section -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div class="bg-white/60 backdrop-blur rounded-xl p-5 text-center">
          <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 class="font-semibold text-gray-800 mb-1">Lightning Fast</h3>
          <p class="text-sm text-gray-500">Create short links in milliseconds</p>
        </div>
        <div class="bg-white/60 backdrop-blur rounded-xl p-5 text-center">
          <div class="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 class="font-semibold text-gray-800 mb-1">No Signup</h3>
          <p class="text-sm text-gray-500">Use anonymously, no account needed</p>
        </div>
        <div class="bg-white/60 backdrop-blur rounded-xl p-5 text-center">
          <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <h3 class="font-semibold text-gray-800 mb-1">QR Codes</h3>
          <p class="text-sm text-gray-500">Auto-generated for every link</p>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="py-6 px-4 border-t border-gray-200/50">
    <div class="max-w-4xl mx-auto text-center">
      <div class="flex items-center justify-center gap-2 mb-2">
        <div class="w-6 h-6 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center">
          <span class="text-white text-xs">✦</span>
        </div>
        <span class="text-gray-600 font-medium">m-space</span>
      </div>
      <p class="text-gray-400 text-sm">
        A community initiative by Indian Muslim professionals
      </p>
      <p class="text-gray-400 text-xs mt-2">
        Credits: <a href="https://aakif.sham.si" target="_blank" class="text-emerald-600 hover:underline">aakif.sham.si</a>
      </p>
    </div>
  </footer>

  <script>
    const form = document.getElementById('shortenForm');
    const urlInput = document.getElementById('urlInput');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    const btnArrow = document.getElementById('btnArrow');
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');
    const resultSection = document.getElementById('resultSection');
    const shortUrlInput = document.getElementById('shortUrl');
    const copyBtn = document.getElementById('copyBtn');
    const copyText = document.getElementById('copyText');
    const copyIcon = document.getElementById('copyIcon');
    const qrCode = document.getElementById('qrCode');
    const visitLink = document.getElementById('visitLink');
    const newLinkBtn = document.getElementById('newLinkBtn');

    function showLoading() {
      btnText.classList.add('hidden');
      btnSpinner.classList.remove('hidden');
      btnArrow.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-75');
    }

    function hideLoading() {
      btnText.classList.remove('hidden');
      btnSpinner.classList.add('hidden');
      btnArrow.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-75');
    }

    function showError(message) {
      errorText.textContent = message;
      errorMsg.classList.remove('hidden');
    }

    function hideError() {
      errorMsg.classList.add('hidden');
    }

    function showResult(shortUrl, slug) {
      shortUrlInput.value = shortUrl;
      qrCode.src = '/qr/' + slug;
      visitLink.href = shortUrl;
      resultSection.classList.remove('hidden');
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function resetForm() {
      form.reset();
      resultSection.classList.add('hidden');
      hideError();
      urlInput.focus();
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();
      showLoading();

      const url = urlInput.value.trim();

      try {
        const response = await fetch('/api/public/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to shorten URL');
        }

        const shortUrl = data.shortUrl;
        showResult(shortUrl, data.slug);

      } catch (err) {
        showError(err.message || 'Something went wrong. Please try again.');
      } finally {
        hideLoading();
      }
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shortUrlInput.value);
        copyText.textContent = 'Copied!';
        copyIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />';
        copyBtn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
        copyBtn.classList.add('bg-emerald-500', 'hover:bg-emerald-600');
        
        setTimeout(() => {
          copyText.textContent = 'Copy';
          copyIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />';
          copyBtn.classList.add('bg-amber-500', 'hover:bg-amber-600');
          copyBtn.classList.remove('bg-emerald-500', 'hover:bg-emerald-600');
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
        shortUrlInput.select();
        document.execCommand('copy');
        copyText.textContent = 'Copied!';
        setTimeout(() => { copyText.textContent = 'Copy'; }, 2000);
      }
    });

    newLinkBtn.addEventListener('click', resetForm);

    // Focus input on load
    urlInput.focus();
  </script>
</body>
</html>`;

  return c.html(landingPageHTML);
});

// Public API endpoint for shortening URLs (no auth required)
publicRoutes.post('/api/public/shorten', async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;

    // Validate URL
    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return c.json({ error: 'Invalid URL format' }, 400);
    }

    const db = createDbHelper(c.env.DB);

    // Generate a random 6-character slug
    const generateSlug = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let slug = '';
      for (let i = 0; i < 6; i++) {
        slug += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return slug;
    };

    // Generate unique slug
    let slug = generateSlug();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existing = await db.get('SELECT id FROM links WHERE slug = ?', [slug]);
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return c.json({ error: 'Failed to generate unique slug. Please try again.' }, 500);
    }

    // Get SITE_URL from settings database
    const siteSetting = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['site_url']);
    const siteUrl = siteSetting?.value || c.env.SITE_URL || 'https://l.m-space.in';

    // Insert directly into database (no user_id for anonymous users)
    await db.run(
      `INSERT INTO links (slug, url, redirect_type, created_by) VALUES (?, ?, ?, ?)`,
      [slug, url, '302', null]
    );

    const shortUrl = `${siteUrl}/${slug}`;

    return c.json({
      success: true,
      shortUrl,
      slug,
      qrUrl: `${siteUrl}/qr/${slug}`,
    });

  } catch (error) {
    console.error('Public shorten error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create short link' 
    }, 500);
  }
});

// Render the interstitial ad page with redirect
function renderInterstitialPage(config: AppConfig, slug: string, targetUrl: string, linkTitle: string | null, settings?: Record<string, string>) {
  const showAds = config.enableAds && config.monetagApiKey;
  
  // SEO settings
  const seoTitle = settings?.seo_title || 'm-space';
  const seoDescription = settings?.seo_description || 'mSpace is a community-based initiative, run by a group of Indian Muslim university students and professionals, focused on improving the representation of Indian Muslims in higher education and professional fields.';
  const seoKeywords = settings?.seo_keywords || 'muslim, space, representation, professional, education, higher education, Indian Muslims, university, community, initiative';
  const enableSeo = settings?.enable_seo !== 'false';
  
  // Banner settings
  const showBanner = settings?.show_banner === 'true';
  const bannerText = settings?.banner_text || '📸 Follow @thisisbilhates on Instagram';
  const bannerLink = settings?.banner_link || '';
  const showCredits = settings?.show_credits !== 'false';

  // Generate random ID for monetag container
  const monetagContainerId = `monetag_${Math.random().toString(36).substring(7)}`;

  // Build SEO meta tags
  const seoMetaTags = enableSeo ? `
  <meta name="title" content="${seoTitle}">
  <meta name="description" content="${seoDescription}">
  <meta name="keywords" content="${seoKeywords}">
  <meta name="robots" content="index, nofollow">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="language" content="English">
  ` : '';

  // Build banner HTML
  const bannerHtml = showBanner ? `
  <div class="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white py-2 px-4 text-center">
    <a href="${bannerLink}" target="_blank" class="hover:underline font-semibold">
      ${bannerText}
    </a>
  </div>` : '';

  // Build credits footer with report ad link
  const reportAdForm = `
  <details class="mt-2">
    <summary class="text-xs text-gray-400 hover:text-gray-300 cursor-pointer">🚩 Report inappropriate ad</summary>
    <form action="/api/report-ad" method="POST" class="mt-2 text-left">
      <input type="hidden" name="slug" value="${slug}">
      <textarea name="description" placeholder="Describe the ad..." rows="2" class="w-full px-2 py-1 text-xs border rounded mb-1 bg-gray-700 text-white"></textarea>
      <input type="email" name="email" placeholder="Your email (optional)" class="w-full px-2 py-1 text-xs border rounded mb-1 bg-gray-700 text-white">
      <button type="submit" class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Submit Report</button>
    </form>
  </details>`;

  const creditsFooter = showCredits ? 
    `<p class="text-gray-500 text-sm">Powered by <a href="https://m-space.in" class="hover:text-white">Muslim Space Link</a> • Credits: <a href="https://aakif.sham.si" target="_blank" class="hover:text-white">aakif.sham.si</a></p>${reportAdForm}` :
    `<p class="text-gray-500 text-sm">Powered by <a href="https://m-space.in" class="hover:text-white">Muslim Space Link</a></p>${reportAdForm}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${linkTitle || 'Redirecting...'}</title>
  ${seoMetaTags}
  <link rel="stylesheet" href="/style.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .loader {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .skip-btn {
      transition: all 0.2s ease;
    }
    .skip-btn:hover {
      transform: scale(1.05);
    }
  </style>
  ${showAds ? `
  <script>
    (function() {
      var monetagConfig = {
        api_key: "${config.monetagApiKey}",
        container: "#${monetagContainerId}",
        slot: "display",
        lazy: false
      };
      // Load Monetag script
      var script = document.createElement('script');
      script.src = 'https://srv.monetag.com/monetag.js';
      script.onload = function() {
        if (typeof Monetag !== 'undefined') {
          Monetag.init(monetagConfig);
        }
      };
      document.head.appendChild(script);
    })();
  </script>` : ''}
</head>
<body class="bg-gray-50 min-h-screen flex flex-col">
  ${bannerHtml}
  
  <div class="flex-grow flex items-center justify-center">
    <div class="text-center">
      <!-- Monetag Ad Container -->
      ${showAds ? `<div id="${monetagContainerId}" class="mb-6 min-h-[250px] flex items-center justify-center"></div>` : '<div class="mb-6"></div>'}
      
      <div class="loader mb-4"></div>
      <h1 class="text-xl font-semibold text-gray-700 mb-2">
        ${linkTitle || 'Redirecting you to your destination...'}
      </h1>
      <p class="text-gray-500 mb-6">Please wait while we redirect you...</p>
      
      <a href="${targetUrl}" class="skip-btn inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg shadow-lg">
        Skip to Link →
      </a>
    </div>
  </div>
  
  <footer class="bg-gray-800 text-gray-400 py-4 text-center text-sm px-4">
    <div>${creditsFooter}</div>
  </footer>
  
  <script>
    // Auto-redirect after 5 seconds
    setTimeout(function() {
      window.location.href = "${targetUrl}";
    }, 5000);
    
    // If monetag is loaded, wait for ad to be displayed before redirecting
    ${showAds ? `
    if (typeof Monetag !== 'undefined') {
      Monetag.on('display', function() {
        // Ad displayed, user can click to go to link
        setTimeout(function() {
          window.location.href = "${targetUrl}";
        }, 3000); // Additional 3 second delay after ad is shown
      });
    }` : ''}
  </script>
</body>
</html>`;
}

// Redirect to long URL based on slug
publicRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = createDbHelper(c.env.DB);
  const links = createLinksService(c.env.DB);
  const analytics = createAnalyticsService(db, c.env.CACHE);

  // Try to get link by slug or custom alias
  const link = await links.getBySlug(slug);

  if (!link) {
    return c.html('<html><body><h1>404 - Link Not Found</h1><p>The link you are looking for does not exist or has been deleted.</p></body></html>', 404);
  }

  // Check if link is active
  if (!link.is_active) {
    return c.html('<html><body><h1>410 - Link Gone</h1><p>This link has been deactivated.</p></body></html>', 410);
  }

  // Check if link has expired
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.html('<html><body><h1>410 - Link Expired</h1><p>This link has expired.</p></body></html>', 410);
  }

  // Check max clicks (approximate using cache, fallback to DB)
  if (link.max_clicks) {
    const cachedClicks = await analytics.getClickCountFromCache(link.id);
    const currentClicks = cachedClicks !== null ? cachedClicks : await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM clicks WHERE link_id = ?',
      [link.id]
    );
    const totalClicks = typeof currentClicks === 'number' ? currentClicks : (currentClicks?.count || 0);
    
    if (totalClicks >= link.max_clicks) {
      return c.html('<html><body><h1>403 - Limit Reached</h1><p>This link has reached its maximum click limit.</p></body></html>', 403);
    }
  }

  // Track the click
  const referrer = c.req.header('Referer') || undefined;
  const userAgent = c.req.header('User-Agent') || undefined;
  
  await analytics.trackClick({
    link_id: link.id,
    referrer,
    user_agent: userAgent,
    // Note: Country/City would require GeoIP lookup, can be added later
  });

  // Get settings from database
  const settingsRecords = await db.all<{ key: string; value: string }>('SELECT * FROM settings');
  const settings: Record<string, string> = Object.fromEntries(settingsRecords.map(s => [s.key, s.value]));
  
  const enableAdsSetting = settings.enable_ads;
  const adsOnRedirectsSetting = settings.ads_on_redirects;
  
  const enableAds = enableAdsSetting !== 'false';
  const adsOnRedirects = adsOnRedirectsSetting !== 'false';
  
  // Check if we're on an admin path - if so, don't show ads
  const path = c.req.path;
  const isAdminPath = path.startsWith('/admin') || path.startsWith('/api');

  // Check if user is logged in - if so, don't show ads
  // Use auth service for consistent session validation
  const auth = createAuthService(c.env.DB);
  const sessionToken = c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1] || null;
  let isLoggedIn = false;
  if (sessionToken) {
    const user = await auth.getUserBySession(sessionToken);
    isLoggedIn = !!user;
  }

  // Check if link has ad-free enabled (overrides global settings)
  const isAdFree = link.ad_free === 1;

  // Get ad configuration from environment
  const config = {
    monetagApiKey: c.env.MONETAG_API_KEY || '',
    enableAds: enableAds && !isAdminPath && !isLoggedIn && !isAdFree && c.env.ENABLE_ADS !== 'false',
    adsOnRedirects: adsOnRedirects && c.env.ENABLE_ADS !== 'false',
    edgymemesInstaPromo: c.env.EDGYMEMES_INSTA_PROMO !== 'false',
  };

  // Check if Instagram embed is enabled and URL is Instagram
  const instagramEmbed = settings.instagram_embed !== 'false';
  const isInstagramUrl = link.url.includes('instagram.com/') || link.url.includes('instagr.am/');

  // Show Instagram embed page if applicable
  if (instagramEmbed && isInstagramUrl && !isAdFree) {
    // Extract Instagram post ID from URL
    let embedCode = '';
    const instaMatch = link.url.match(/(?:instagram\.com|instagr\.am)\/p\/([a-zA-Z0-9_-]+)/);
    if (instaMatch) {
      embedCode = `<iframe src="https://www.instagram.com/p/${instaMatch[1]}/embed" width="414" height="480" frameborder="0" scrolling="no" allowtransparency="true" style="border-radius: 8px;"></iframe>`;
    } else {
      // For profile links, just show a link card
      embedCode = `
        <div class="bg-white rounded-lg shadow p-6 text-center">
          <p class="text-gray-600 mb-4">Redirecting to Instagram...</p>
          <a href="${link.url}" class="text-blue-600 hover:underline">Open Instagram</a>
        </div>
      `;
    }
    
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Instagram - m-space</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 min-h-screen flex items-center justify-center">
        <div class="max-w-md w-full">
          ${embedCode}
          <div class="text-center mt-4">
            <a href="${link.url}" class="text-gray-500 hover:text-gray-700 text-sm">Not loading? <span class="underline">Click here</span></a>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // Show interstitial page with ads (unless ads are disabled or link is ad-free)
  if (config.enableAds && config.adsOnRedirects && config.monetagApiKey) {
    return c.html(renderInterstitialPage(config as unknown as AppConfig, slug, link.url, link.title, settings));
  }

  // Perform redirect without ads
  const redirectType = link.redirect_type === '301' ? 301 : 302;
  
  // Handle referrer masking
  const hideReferrer = settings.hide_referrer !== 'false';
  
  // Set response with referrer policy
  if (hideReferrer) {
    // Use meta refresh to mask referrer
    // Or use 303 to avoid sending referrer
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redirecting...</title>
        <meta name="referrer" content="no-referrer">
        <meta http-equiv="refresh" content="0;url=${link.url}">
      </head>
      <body>
        <p>Redirecting...</p>
        <a href="${link.url}">Click here if not redirected</a>
      </body>
      </html>
    `, 302, {
      'Referrer-Policy': 'no-referrer',
      'X-Referrer-Policy': 'no-referrer',
    });
  }
  
  return c.redirect(link.url, redirectType);
});

// Ad Report API - Public endpoint for reporting inappropriate ads
publicRoutes.post('/api/report-ad', async (c) => {
  try {
    const db = createDbHelper(c.env.DB);
    
    // Get the ad_report_email setting
    const reportEmailSetting = await db.get<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['ad_report_email']
    );
    const reportEmail = reportEmailSetting?.value || '';

    // Parse the request body
    const body = await c.req.parseBody();
    const description = body.description as string || '';
    const email = body.email as string || '';
    const slug = body.slug as string || '';

    // Validate description is provided
    if (!description || description.trim().length === 0) {
      return c.json({ 
        success: false, 
        message: 'Description is required' 
      }, 400);
    }

    // Get the site URL for reference
    const siteSetting = await db.get<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['site_url']
    );
    const siteUrl = siteSetting?.value || c.env.SITE_URL || 'https://l.m-space.in';

    // Log the report
    console.log('=== AD REPORT SUBMITTED ===');
    console.log('Slug:', slug || 'N/A');
    console.log('Page:', slug ? `${siteUrl}/${slug}` : 'N/A');
    console.log('Reporter Email:', email || 'Not provided');
    console.log('Description:', description);
    console.log('Report Email:', reportEmail || 'Not configured');
    console.log('Timestamp:', new Date().toISOString());
    console.log('===========================');

    // TODO: In production, you could send an email here using a service like:
    // - Cloudflare Workers Email
    // - SendGrid
    // - Mailgun
    // For now, we just log it and return success

    return c.json({ 
      success: true, 
      message: 'Report received. Thank you for helping keep our platform clean.' 
    });

  } catch (error) {
    console.error('Ad report error:', error);
    return c.json({ 
      success: false, 
      message: 'Failed to submit report. Please try again.' 
    }, 500);
  }
});

// QR code endpoint for a link
publicRoutes.get('/qr/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = createDbHelper(c.env.DB);
  const links = createLinksService(c.env.DB);

  const link = await links.getBySlug(slug);
  if (!link) {
    return c.html('<html><body><h1>404 - Link Not Found</h1></body></html>', 404);
  }

  try {
    const { generateQRSvg } = await import('../services/qr');
    
    // Get SITE_URL from settings database
    const siteSetting = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['site_url']);
    const siteUrl = siteSetting?.value || c.env.SITE_URL || 'https://l.m-space.in';
    const fullUrl = `${siteUrl}/${slug}`;
    const svg = await generateQRSvg(fullUrl, 300);

    return c.text(svg, 200, { 'Content-Type': 'image/svg+xml' });
  } catch (error) {
    console.error('QR generation error:', error);
    return c.html('<html><body><h1>500 - QR Generation Failed</h1></body></html>', 500);
  }
});

// Info page for a link (optional, for preview)
publicRoutes.get('/info/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = createDbHelper(c.env.DB);
  const links = createLinksService(c.env.DB);

  const link = await links.getBySlug(slug);
  if (!link) {
    return c.html('<html><body><h1>404 - Link Not Found</h1></body></html>', 404);
  }

  // Get SITE_URL from settings database
  const siteSetting = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['site_url']);
  const siteUrl = siteSetting?.value || c.env.SITE_URL || 'https://l.m-space.in';
  const fullUrl = `${siteUrl}/${slug}`;
  const { generateQRSvg } = await import('../services/qr');
  const qrSvg = await generateQRSvg(fullUrl, 200);

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${link.title || 'Link Info'}</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center">
      <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 class="text-2xl font-bold mb-4">${link.title || 'Link Info'}</h1>
        ${link.description ? `<p class="text-gray-600 mb-4">${link.description}</p>` : ''}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Original URL</label>
          <a href="${link.url}" class="text-blue-600 hover:underline break-all">${link.url}</a>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Short URL</label>
          <a href="${fullUrl}" class="text-blue-600 hover:underline">${fullUrl}</a>
        </div>
        <div class="flex justify-center mb-4">
          ${qrSvg}
        </div>
        <div class="text-sm text-gray-500">
          Created: ${new Date(link.created_at).toLocaleDateString()}
        </div>
      </div>
    </body>
    </html>
  `);
});