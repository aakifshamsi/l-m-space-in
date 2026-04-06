import type { User } from '../config';
import { renderLayout } from './layout';
import { getAvailableProviders } from '../services/ai';

export interface SettingsPageProps {
  user: User;
  settings: Record<string, string>;
  enableAds?: boolean;
}

export function renderSettingsPage({ user, settings, enableAds = true }: SettingsPageProps): string {
  const providers = getAvailableProviders();

  return renderLayout({
    title: 'Settings - Muslim Space Link',
    user,
    activeNav: 'settings',
    enableAds,
    children: `
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
          <p class="text-gray-500 mt-1">Configure your link shortener</p>
        </div>

        <form method="POST" action="/admin/settings" class="space-y-6">
          <!-- Link Defaults -->
          <div class="bg-white rounded-lg shadow">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">Link Defaults</h2>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label for="default_redirect_type" class="block text-sm font-medium text-gray-700 mb-1">
                  Default Redirect Type
                </label>
                <select
                  id="default_redirect_type"
                  name="default_redirect_type"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="302" ${settings.default_redirect_type === '302' ? 'selected' : ''}>302 Temporary Redirect</option>
                  <option value="301" ${settings.default_redirect_type === '301' ? 'selected' : ''}>301 Permanent Redirect</option>
                </select>
                <p class="text-sm text-gray-500 mt-1">301 is better for SEO but use 302 for temporary links</p>
              </div>

              <div>
                <label for="links_per_page" class="block text-sm font-medium text-gray-700 mb-1">
                  Links Per Page
                </label>
                <input
                  type="number"
                  id="links_per_page"
                  name="links_per_page"
                  min="5"
                  max="100"
                  value="${settings.links_per_page || '20'}"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
              </div>
            </div>
          </div>

          <!-- AI Integration -->
          <div class="bg-white rounded-lg shadow">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
                AI Integration
              </h2>
            </div>
            <div class="p-6 space-y-6">
              <!-- Enable AI Toggle -->
              <div class="flex items-center justify-between">
                <div>
                  <label for="ai_enabled" class="text-sm font-medium text-gray-700">Enable AI Features</label>
                  <p class="text-xs text-gray-500">Allow users to generate content with AI</p>
                </div>
                <div class="relative">
                  <input type="hidden" name="ai_enabled" value="false">
                  <input
                    type="checkbox"
                    id="ai_enabled"
                    name="ai_enabled"
                    value="true"
                    ${settings.ai_enabled === 'true' ? 'checked' : ''}
                    class="sr-only peer"
                    onchange="toggleAIFields(this.checked)"
                  >
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </div>
              </div>

              <!-- AI Provider Selection -->
              <div id="ai-fields" class="${settings.ai_enabled !== 'true' ? 'opacity-50 pointer-events-none' : ''}">
                <div>
                  <label for="ai_provider" class="block text-sm font-medium text-gray-700 mb-1">
                    AI Provider
                  </label>
                  <select
                    id="ai_provider"
                    name="ai_provider"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    ${providers.map(p => `
                      <option value="${p.id}" ${settings.ai_provider === p.id ? 'selected' : ''}>
                        ${p.name} - ${p.description}
                      </option>
                    `).join('')}
                  </select>
                </div>

                <!-- Ollama Settings -->
                <div id="ollama-settings" class="mt-4 p-4 bg-gray-50 rounded-lg space-y-4 ${settings.ai_provider === 'ollama' ? '' : 'hidden'}">
                  <h4 class="text-sm font-medium text-gray-700">Ollama Configuration</h4>
                  <div>
                    <label for="ai_ollama_endpoint" class="block text-sm font-medium text-gray-700 mb-1">
                      Ollama Endpoint
                    </label>
                    <input
                      type="url"
                      id="ai_ollama_endpoint"
                      name="ai_ollama_endpoint"
                      value="${settings.ai_ollama_endpoint || 'http://localhost:11434'}"
                      placeholder="http://localhost:11434"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                    <p class="text-xs text-gray-500 mt-1">URL of your Ollama server (local or cloud)</p>
                  </div>
                  <div>
                    <label for="ai_ollama_model" class="block text-sm font-medium text-gray-700 mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      id="ai_ollama_model"
                      name="ai_ollama_model"
                      value="${settings.ai_ollama_model || 'llama3'}"
                      placeholder="llama3"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                    <p class="text-xs text-gray-500 mt-1">Ollama model to use (e.g., llama3, mistral, codellama)</p>
                  </div>
                </div>

                <!-- OpenRouter Settings -->
                <div id="openrouter-settings" class="mt-4 p-4 bg-gray-50 rounded-lg space-y-4 ${settings.ai_provider === 'openrouter' ? '' : 'hidden'}">
                  <h4 class="text-sm font-medium text-gray-700">OpenRouter Configuration</h4>
                  <div>
                    <label for="ai_openrouter_api_key" class="block text-sm font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      id="ai_openrouter_api_key"
                      name="ai_openrouter_api_key"
                      value="${settings.ai_openrouter_api_key || ''}"
                      placeholder="sk-or-v1-..."
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                    <p class="text-xs text-gray-500 mt-1">Get your API key from <a href="https://openrouter.ai/keys" target="_blank" class="text-emerald-600 hover:underline">openrouter.ai/keys</a></p>
                  </div>
                  <div>
                    <label for="ai_openrouter_model" class="block text-sm font-medium text-gray-700 mb-1">
                      Model
                    </label>
                    <select
                      id="ai_openrouter_model"
                      name="ai_openrouter_model"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="anthropic/claude-3-haiku" ${settings.ai_openrouter_model === 'anthropic/claude-3-haiku' ? 'selected' : ''}>Claude 3 Haiku (Fast, Affordable)</option>
                      <option value="anthropic/claude-3-sonnet" ${settings.ai_openrouter_model === 'anthropic/claude-3-sonnet' ? 'selected' : ''}>Claude 3 Sonnet (Balanced)</option>
                      <option value="openai/gpt-4o-mini" ${settings.ai_openrouter_model === 'openai/gpt-4o-mini' ? 'selected' : ''}>GPT-4o Mini (Fast)</option>
                      <option value="google/gemini-pro-1.5" ${settings.ai_openrouter_model === 'google/gemini-pro-1.5' ? 'selected' : ''}>Gemini Pro 1.5</option>
                    </select>
                  </div>
                </div>

                <!-- Trial Settings -->
                <div class="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                  <h4 class="text-sm font-medium text-gray-700">Trial Configuration</h4>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="ai_trial_days" class="block text-sm font-medium text-gray-700 mb-1">
                        Trial Duration (days)
                      </label>
                      <input
                        type="number"
                        id="ai_trial_days"
                        name="ai_trial_days"
                        value="${settings.ai_trial_days || '30'}"
                        min="1"
                        max="365"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                    </div>
                    <div>
                      <label for="ai_trial_credits" class="block text-sm font-medium text-gray-700 mb-1">
                        Daily Credits
                      </label>
                      <input
                        type="number"
                        id="ai_trial_credits"
                        name="ai_trial_credits"
                        value="${settings.ai_trial_credits || '100'}"
                        min="1"
                        max="1000"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ai_daily_reset"
                      name="ai_daily_reset"
                      value="true"
                      ${settings.ai_daily_reset !== 'false' ? 'checked' : ''}
                      class="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    >
                    <label for="ai_daily_reset" class="text-sm text-gray-700">Reset credits daily at midnight</label>
                  </div>
                </div>
              </div>

              <p class="text-sm text-gray-500">
                <a href="/admin/ai-content" class="text-emerald-600 hover:underline">Go to AI Content Generator</a>
              </p>
            </div>
          </div>

          <script>
            function toggleAIFields(enabled) {
              const fields = document.getElementById('ai-fields');
              if (enabled) {
                fields.classList.remove('opacity-50', 'pointer-events-none');
              } else {
                fields.classList.add('opacity-50', 'pointer-events-none');
              }
            }

            function toggleProviderSettings() {
              const provider = document.getElementById('ai_provider').value;
              document.getElementById('ollama-settings').classList.toggle('hidden', provider !== 'ollama');
              document.getElementById('openrouter-settings').classList.toggle('hidden', provider !== 'openrouter');
            }

            document.getElementById('ai_provider')?.addEventListener('change', toggleProviderSettings);
          </script>

          <!-- Branding Settings -->
          <div class="bg-white rounded-lg shadow border-l-4 border-emerald-500">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                Branding
              </h2>
            </div>
            <div class="p-6 space-y-6">
              <!-- Color Scheme -->
              <div class="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 class="text-sm font-medium text-gray-700 mb-3">Color Scheme</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label for="primary_color" class="block text-sm font-medium text-gray-700 mb-1">
                      Primary Color
                    </label>
                    <div class="flex items-center gap-2">
                      <input
                        type="color"
                        id="primary_color_preview"
                        value="${settings.primary_color || '#10B981'}"
                        class="w-12 h-10 rounded cursor-pointer border border-gray-300"
                        onchange="document.getElementById('primary_color').value = this.value; updateColorPreview()"
                      >
                      <input
                        type="text"
                        id="primary_color"
                        name="primary_color"
                        value="${settings.primary_color || '#10B981'}"
                        pattern="#?[0-9A-Fa-f]{6}"
                        placeholder="#10B981"
                        class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                        oninput="document.getElementById('primary_color_preview').value = this.value.startsWith('#') ? this.value : '#' + this.value; updateColorPreview()"
                      >
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Default: #10B981 (Emerald)</p>
                  </div>
                  <div>
                    <label for="secondary_color" class="block text-sm font-medium text-gray-700 mb-1">
                      Secondary Color
                    </label>
                    <div class="flex items-center gap-2">
                      <input
                        type="color"
                        id="secondary_color_preview"
                        value="${settings.secondary_color || '#F59E0B'}"
                        class="w-12 h-10 rounded cursor-pointer border border-gray-300"
                        onchange="document.getElementById('secondary_color').value = this.value; updateColorPreview()"
                      >
                      <input
                        type="text"
                        id="secondary_color"
                        name="secondary_color"
                        value="${settings.secondary_color || '#F59E0B'}"
                        pattern="#?[0-9A-Fa-f]{6}"
                        placeholder="#F59E0B"
                        class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                        oninput="document.getElementById('secondary_color_preview').value = this.value.startsWith('#') ? this.value : '#' + this.value; updateColorPreview()"
                      >
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Default: #F59E0B (Amber)</p>
                  </div>
                </div>
                <div class="mt-4">
                  <p class="text-xs text-gray-500 mb-2">Preview:</p>
                  <div class="flex gap-2 items-center">
                    <span id="primary_preview" class="px-3 py-1 rounded text-white text-sm" style="background-color: ${settings.primary_color || '#10B981'}">Primary</span>
                    <span id="secondary_preview" class="px-3 py-1 rounded text-white text-sm" style="background-color: ${settings.secondary_color || '#F59E0B'}">Secondary</span>
                    <button id="btn_preview" class="px-3 py-1 rounded text-white text-sm" style="background-color: ${settings.primary_color || '#10B981'}">Button</button>
                    <a id="link_preview" href="#" class="px-3 py-1 rounded text-sm underline" style="color: ${settings.primary_color || '#10B981'}">Link</a>
                  </div>
                </div>
              </div>

              <!-- Site Identity -->
              <div>
                <label for="site_name" class="block text-sm font-medium text-gray-700 mb-1">
                  Site Name
                </label>
                <input
                  type="text"
                  id="site_name"
                  name="site_name"
                  value="${settings.site_name || 'm-space'}"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
              </div>

              <div>
                <label for="site_tagline" class="block text-sm font-medium text-gray-700 mb-1">
                  Site Tagline
                </label>
                <input
                  type="text"
                  id="site_tagline"
                  name="site_tagline"
                  value="${settings.site_tagline || ''}"
                  placeholder="Your site's tagline"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
              </div>

              <!-- Logo & Favicon -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="site_logo_url" class="block text-sm font-medium text-gray-700 mb-1">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    id="site_logo_url"
                    name="site_logo_url"
                    value="${settings.site_logo_url || ''}"
                    placeholder="https://example.com/logo.png"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                  ${settings.site_logo_url ? `
                    <div class="mt-2">
                      <img src="${settings.site_logo_url}" alt="Logo preview" class="h-12 object-contain" onerror="this.style.display='none'">
                    </div>
                  ` : ''}
                </div>

                <div>
                  <label for="site_favicon_url" class="block text-sm font-medium text-gray-700 mb-1">
                    Favicon URL
                  </label>
                  <input
                    type="url"
                    id="site_favicon_url"
                    name="site_favicon_url"
                    value="${settings.site_favicon_url || ''}"
                    placeholder="https://example.com/favicon.ico"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                  ${settings.site_favicon_url ? `
                    <div class="mt-2 flex items-center gap-2">
                      <img src="${settings.site_favicon_url}" alt="Favicon preview" class="w-6 h-6 object-contain" onerror="this.style.display='none'">
                      <span class="text-xs text-gray-500">Favicon preview</span>
                    </div>
                  ` : ''}
                </div>
              </div>

              <script>
                function updateColorPreview() {
                  const primary = document.getElementById('primary_color').value;
                  const secondary = document.getElementById('secondary_color').value;
                  const p = primary.startsWith('#') ? primary : '#' + primary;
                  const s = secondary.startsWith('#') ? secondary : '#' + secondary;
                  document.getElementById('primary_preview').style.backgroundColor = p;
                  document.getElementById('secondary_preview').style.backgroundColor = s;
                  document.getElementById('btn_preview').style.backgroundColor = p;
                  document.getElementById('link_preview').style.color = p;
                }
              </script>
            </div>
          </div>

          <!-- SEO Settings -->
          <div class="bg-white rounded-lg shadow border-l-4 border-blue-500">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                SEO Settings
              </h2>
            </div>
            <div class="p-6 space-y-6">
              <div>
                <label for="seo_title" class="block text-sm font-medium text-gray-700 mb-1">
                  SEO Meta Title
                </label>
                <input
                  type="text"
                  id="seo_title"
                  name="seo_title"
                  value="${settings.seo_title || 'm-space'}"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
              </div>

              <div>
                <label for="seo_description" class="block text-sm font-medium text-gray-700 mb-1">
                  SEO Meta Description
                </label>
                <textarea
                  id="seo_description"
                  name="seo_description"
                  rows="2"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >${settings.seo_description || 'mSpace is a community-based initiative, run by a group of Indian Muslim university students and professionals, focused on improving the representation of Indian Muslims in higher education and professional fields.'}</textarea>
              </div>

              <div>
                <label for="seo_keywords" class="block text-sm font-medium text-gray-700 mb-1">
                  SEO Keywords
                </label>
                <input
                  type="text"
                  id="seo_keywords"
                  name="seo_keywords"
                  value="${settings.seo_keywords || 'muslim, space, representation, professional, education, higher education, Indian Muslims, university, community, initiative'}"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
              </div>

              <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <label for="enable_seo" class="block text-sm font-medium text-gray-900">
                    Enable SEO Meta Tags
                  </label>
                  <p class="text-sm text-gray-600">
                    Add SEO meta tags to redirect pages (allows indexing but discourages crawling)
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="enable_seo"
                    name="enable_seo"
                    value="true"
                    class="sr-only peer"
                    ${settings.enable_seo !== 'false' ? 'checked' : ''}
                  >
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- Banner & Credit Settings -->
          <div class="bg-white rounded-lg shadow border-l-4 border-purple-500">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
                Banner & Credits
              </h2>
            </div>
            <div class="p-6 space-y-6">
              <div class="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div>
                  <label for="show_banner" class="block text-sm font-medium text-gray-900">
                    Show Banner on Redirects
                  </label>
                  <p class="text-sm text-gray-600">
                    Show promotional banner on redirect pages
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="show_banner"
                    name="show_banner"
                    value="true"
                    class="sr-only peer"
                    ${settings.show_banner === 'true' ? 'checked' : ''}
                  >
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div>
                <label for="banner_text" class="block text-sm font-medium text-gray-700 mb-1">
                  Banner Text
                </label>
                <input
                  type="text"
                  id="banner_text"
                  name="banner_text"
                  value="${settings.banner_text || '📸 Follow @thisisbilhates on Instagram'}"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
              </div>

              <div>
                <label for="banner_link" class="block text-sm font-medium text-gray-700 mb-1">
                  Banner Link URL
                </label>
                <input
                  type="url"
                  id="banner_link"
                  name="banner_link"
                  value="${settings.banner_link || ''}"
                  placeholder="https://instagram.com/..."
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
              </div>

              <div class="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div>
                  <label for="show_credits" class="block text-sm font-medium text-gray-900">
                    Show Credits to aakif.sham.si
                  </label>
                  <p class="text-sm text-gray-600">
                    Show "Credits: aakif.sham.si" in footer
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="show_credits"
                    name="show_credits"
                    value="true"
                    class="sr-only peer"
                    ${settings.show_credits !== 'false' ? 'checked' : ''}
                  >
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- Referrer & Instagram Settings -->
          <div class="bg-white rounded-lg shadow border-l-4 border-orange-500">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                Referrer & Instagram Embed
              </h2>
            </div>
            <div class="p-6 space-y-6">
              <div class="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                <div>
                  <label for="hide_referrer" class="block text-sm font-medium text-gray-900">
                    Hide Referrer
                  </label>
                  <p class="text-sm text-gray-600">
                    Don't expose m-space.in as referrer
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="hide_referrer"
                    name="hide_referrer"
                    value="true"
                    class="sr-only peer"
                    ${settings.hide_referrer !== 'false' ? 'checked' : ''}
                  >
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              <div>
                <label for="custom_referrer" class="block text-sm font-medium text-gray-700 mb-1">
                  Custom Referrer Domain
                </label>
                <input
                  type="text"
                  id="custom_referrer"
                  name="custom_referrer"
                  value="${settings.custom_referrer || 'digitalhands.in'}"
                  placeholder="digitalhands.in"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
              </div>

              <div class="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                <div>
                  <label for="instagram_embed" class="block text-sm font-medium text-gray-900">
                    Instagram Embed
                  </label>
                  <p class="text-sm text-gray-600">
                    Embed Instagram posts when destination is Instagram URL
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="instagram_embed"
                    name="instagram_embed"
                    value="true"
                    class="sr-only peer"
                    ${settings.instagram_embed !== 'false' ? 'checked' : ''}
                  >
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- Handles Link -->
          <div class="bg-white rounded-lg shadow">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">Social Profiles</h2>
            </div>
            <div class="p-6">
              <p class="text-gray-600 mb-4">Manage social media handles for promotions and banners.</p>
              <a href="/admin/handles" class="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                Manage Handles
              </a>
            </div>
          </div>

          <!-- Ads Settings -->
          <div class="bg-white rounded-lg shadow border-l-4 border-emerald-500">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path>
                </svg>
                Advertisement Settings
              </h2>
            </div>
            <div class="p-6 space-y-6">
              <div class="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                <div>
                  <label for="enable_ads" class="block text-sm font-medium text-gray-900">
                    Enable Ads
                  </label>
                  <p class="text-sm text-gray-600">
                    Globally enable or disable all advertisements
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="enable_ads"
                    name="enable_ads"
                    value="true"
                    class="sr-only peer"
                    ${settings.enable_ads !== 'false' ? 'checked' : ''}
                  >
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label for="ads_on_redirects" class="block text-sm font-medium text-gray-900">
                    Ads on Short Link Redirects
                  </label>
                  <p class="text-sm text-gray-600">
                    Show ads on interstitial redirect pages
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="ads_on_redirects"
                    name="ads_on_redirects"
                    value="true"
                    class="sr-only peer"
                    ${settings.ads_on_redirects !== 'false' ? 'checked' : ''}
                  >
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- Ad Moderation -->
          <div class="bg-white rounded-lg shadow border-l-4 border-red-500">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path>
                </svg>
                Ad Moderation
              </h2>
            </div>
            <div class="p-6 space-y-4">
              <div class="p-4 bg-red-50 rounded-lg border border-red-100">
                <p class="text-sm text-red-700">
                  <strong>Note:</strong> Monetag filters ads automatically but inappropriate content may occasionally appear.
                  Use the form below to report any inappropriate advertisements.
                </p>
              </div>

              <div>
                <label for="ad_report_email" class="block text-sm font-medium text-gray-700 mb-1">
                  Support Contact Email
                </label>
                <input
                  type="email"
                  id="ad_report_email"
                  name="ad_report_email"
                  value="${settings.ad_report_email || ''}"
                  placeholder="support@example.com"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                <p class="text-xs text-gray-500 mt-1">Email address where ad reports will be sent</p>
              </div>

              <div class="p-4 bg-gray-50 rounded-lg">
                <h4 class="text-sm font-medium text-gray-700 mb-2">How to Report Inappropriate Ads:</h4>
                <ol class="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Note the advertiser name or company shown in the ad</li>
                  <li>Take a screenshot of the ad</li>
                  <li>Submit the report using the form on redirect pages</li>
                </ol>
              </div>
            </div>
          </div>

          <!-- Submit -->
          <div class="flex justify-end">
            <button
              type="submit"
              class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    `,
  });
}