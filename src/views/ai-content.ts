// AI Content Generation UI
// Provides interface for generating blog content, social captions, and more

import type { User } from '../config';
import type { AIConfig } from '../services/ai';
import type { TrialStatus } from '../services/ai-trial';
import { renderLayout } from './layout';

export interface AIContentPageProps {
  user: User;
  settings: Record<string, string>;
  aiConfig: AIConfig;
  trialStatus: TrialStatus;
  message?: string;
  error?: string;
  generatedContent?: string;
  enableAds?: boolean;
}

export function renderAIContentPage({
  user,
  settings: _settings,
  aiConfig,
  trialStatus,
  message,
  error,
  generatedContent,
  enableAds = true,
}: AIContentPageProps): string {
  const isEnabled = aiConfig.enabled;
  const hasTrial = trialStatus.hasActiveTrial;
  const isConfigured = aiConfig.provider !== 'none';

  // Calculate credits display
  const creditsRemaining = trialStatus.creditsRemaining;
  const daysRemaining = trialStatus.daysRemaining;
  const progressPercent = Math.min(100, (creditsRemaining / 100) * 100);

  return renderLayout({
    title: 'AI Content - Muslim Space Link',
    user,
    activeNav: 'ai-content',
    enableAds,
    children: `
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-gray-900">AI Content Generator</h1>
          <p class="text-gray-500 mt-1">Create engaging content with AI assistance</p>
        </div>

        <!-- Status Banner -->
        ${!isEnabled ? `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div>
                <p class="font-medium text-yellow-800">AI Features Disabled</p>
                <p class="text-sm text-yellow-700">Enable AI in <a href="/admin/settings" class="underline">Settings</a> to use content generation.</p>
              </div>
            </div>
          </div>
        ` : !isConfigured ? `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div>
                <p class="font-medium text-yellow-800">AI Not Configured</p>
                <p class="text-sm text-yellow-700">Configure an AI provider in <a href="/admin/settings" class="underline">Settings</a>.</p>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Messages -->
        ${message ? `
          <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p class="text-green-800">${message}</p>
          </div>
        ` : ''}
        ${error ? `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p class="text-red-800">${error}</p>
          </div>
        ` : ''}

        <!-- Trial Status Card -->
        ${isEnabled && isConfigured ? `
          <div class="bg-white rounded-lg shadow mb-6">
            <div class="p-6">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900">Your AI Trial</h2>
                ${!hasTrial ? `
                  <form method="POST" action="/admin/ai-content/start-trial">
                    <button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                      Start Free Trial
                    </button>
                  </form>
                ` : `
                  <span class="px-3 py-1 text-sm font-medium rounded-full ${daysRemaining <= 3 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}">
                    ${daysRemaining} days remaining
                  </span>
                `}
              </div>

              ${hasTrial ? `
                <div class="space-y-4">
                  <!-- Credits Progress -->
                  <div>
                    <div class="flex justify-between text-sm mb-1">
                      <span class="text-gray-600">Credits Remaining</span>
                      <span class="font-medium text-gray-900">${creditsRemaining} / 100</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                      <div class="bg-emerald-600 h-2.5 rounded-full transition-all" style="width: ${progressPercent}%"></div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Credits reset daily at midnight</p>
                  </div>

                  <!-- Quick Stats -->
                  <div class="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                    <div class="text-center">
                      <p class="text-2xl font-bold text-gray-900">3</p>
                      <p class="text-sm text-gray-500">Blog Post</p>
                    </div>
                    <div class="text-center">
                      <p class="text-2xl font-bold text-gray-900">1</p>
                      <p class="text-sm text-gray-500">Social Caption</p>
                    </div>
                    <div class="text-center">
                      <p class="text-2xl font-bold text-gray-900">1</p>
                      <p class="text-sm text-gray-500">Link Description</p>
                    </div>
                  </div>
                </div>
              ` : `
                <div class="text-center py-4">
                  <p class="text-gray-600 mb-4">Start your 30-day free trial with 100 credits daily!</p>
                  <ul class="text-sm text-gray-500 space-y-1">
                    <li>✓ Generate blog posts</li>
                    <li>✓ Create social media captions</li>
                    <li>✓ Generate link descriptions</li>
                    <li>✓ 100 credits per day (resets daily)</li>
                  </ul>
                </div>
              `}
            </div>
          </div>
        ` : ''}

        <!-- Content Generation Forms -->
        ${isEnabled && isConfigured && hasTrial ? `
          <!-- Tab Navigation -->
          <div class="bg-white rounded-lg shadow mb-6">
            <div class="border-b border-gray-200">
              <nav class="flex -mb-px" aria-label="Tabs">
                <button type="button" onclick="switchTab('blog')" id="tab-blog" class="tab-btn px-6 py-3 border-b-2 border-emerald-500 text-emerald-600 font-medium text-sm">
                  Blog Post
                </button>
                <button type="button" onclick="switchTab('social')" id="tab-social" class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm">
                  Social Caption
                </button>
                <button type="button" onclick="switchTab('description')" id="tab-description" class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm">
                  Link Description
                </button>
              </nav>
            </div>

            <!-- Blog Content Tab -->
            <div id="panel-blog" class="tab-panel p-6">
              <form hx-post="/api/ai/generate" hx-target="#blog-result" hx-swap="innerHTML">
                <input type="hidden" name="type" value="blog">
                
                <div class="space-y-4">
                  <div>
                    <label for="topic" class="block text-sm font-medium text-gray-700 mb-1">
                      Topic <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="topic"
                      name="topic"
                      required
                      placeholder="e.g., Benefits of reading Quran daily"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="tone" class="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                      <select
                        id="tone"
                        name="tone"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="friendly" selected>Friendly</option>
                        <option value="humorous">Humorous</option>
                        <option value="informative">Informative</option>
                      </select>
                    </div>

                    <div>
                      <label for="length" class="block text-sm font-medium text-gray-700 mb-1">Length</label>
                      <select
                        id="length"
                        name="length"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="short">Short (150-200 words)</option>
                        <option value="medium" selected>Medium (300-400 words)</option>
                        <option value="long">Long (600-800 words)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label for="format" class="block text-sm font-medium text-gray-700 mb-1">Format</label>
                    <select
                      id="format"
                      name="format"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="markdown" selected>Markdown</option>
                      <option value="html">HTML</option>
                      <option value="plain">Plain Text</option>
                    </select>
                  </div>

                  <div class="flex items-center justify-between pt-4">
                    <p class="text-sm text-gray-500">Cost: 3 credits</p>
                    <button
                      type="submit"
                      class="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      ${creditsRemaining < 3 ? 'disabled' : ''}
                    >
                      <span class="htmx-indicator">Generating...</span>
                      <span class="htmx-hidden">Generate Blog Post</span>
                      <span class="htmx-request">Generating...</span>
                    </button>
                  </div>
                </div>
              </form>

              <div id="blog-result" class="mt-6"></div>
            </div>

            <!-- Social Caption Tab -->
            <div id="panel-social" class="tab-panel p-6 hidden">
              <form hx-post="/api/ai/generate" hx-target="#social-result" hx-swap="innerHTML">
                <input type="hidden" name="type" value="social">
                
                <div class="space-y-4">
                  <div>
                    <label for="url" class="block text-sm font-medium text-gray-700 mb-1">
                      URL <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      id="url"
                      name="url"
                      required
                      placeholder="https://example.com/article"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                  </div>

                  <div>
                    <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
                      Title <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      required
                      placeholder="Amazing Article About Something"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                  </div>

                  <div>
                    <label for="platform" class="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                    <select
                      id="platform"
                      name="platform"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="twitter">Twitter / X</option>
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>

                  <div class="flex items-center justify-between pt-4">
                    <p class="text-sm text-gray-500">Cost: 1 credit</p>
                    <button
                      type="submit"
                      class="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      ${creditsRemaining < 1 ? 'disabled' : ''}
                    >
                      <span class="htmx-indicator">Generating...</span>
                      <span class="htmx-hidden">Generate Caption</span>
                      <span class="htmx-request">Generating...</span>
                    </button>
                  </div>
                </div>
              </form>

              <div id="social-result" class="mt-6"></div>
            </div>

            <!-- Link Description Tab -->
            <div id="panel-description" class="tab-panel p-6 hidden">
              <form hx-post="/api/ai/generate" hx-target="#description-result" hx-swap="innerHTML">
                <input type="hidden" name="type" value="description">
                
                <div class="space-y-4">
                  <div>
                    <label for="desc-url" class="block text-sm font-medium text-gray-700 mb-1">
                      URL <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      id="desc-url"
                      name="url"
                      required
                      placeholder="https://example.com/article"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                  </div>

                  <div>
                    <label for="desc-title" class="block text-sm font-medium text-gray-700 mb-1">
                      Title <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="desc-title"
                      name="title"
                      required
                      placeholder="Amazing Article Title"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                  </div>

                  <div class="flex items-center justify-between pt-4">
                    <p class="text-sm text-gray-500">Cost: 1 credit</p>
                    <button
                      type="submit"
                      class="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      ${creditsRemaining < 1 ? 'disabled' : ''}
                    >
                      <span class="htmx-indicator">Generating...</span>
                      <span class="htmx-hidden">Generate Description</span>
                      <span class="htmx-request">Generating...</span>
                    </button>
                  </div>
                </div>
              </form>

              <div id="description-result" class="mt-6"></div>
            </div>
          </div>

          <!-- Generated Content Display -->
          ${generatedContent ? `
            <div class="bg-white rounded-lg shadow">
              <div class="p-6 border-b border-gray-200">
                <div class="flex items-center justify-between">
                  <h2 class="text-lg font-semibold text-gray-900">Generated Content</h2>
                  <button onclick="copyContent()" class="text-sm text-emerald-600 hover:text-emerald-700">
                    Copy to clipboard
                  </button>
                </div>
              </div>
              <div class="p-6">
                <div id="generated-content" class="prose max-w-none">${generatedContent}</div>
              </div>
            </div>
          ` : ''}
        ` : ''}

        <!-- Coming Soon / Disabled State -->
        ${!isEnabled || !isConfigured || !hasTrial ? `
          <div class="bg-gray-100 rounded-lg p-8 text-center">
            <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            <h3 class="text-lg font-medium text-gray-900 mb-2">AI Content Generation</h3>
            <p class="text-gray-500 mb-4">
              ${!hasTrial ? 'Start your free trial to unlock AI-powered content generation!' : 'Configure AI in settings to get started.'}
            </p>
            ${hasTrial ? `
              <a href="/admin/settings" class="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                Configure AI Settings
              </a>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <script>
        function switchTab(tab) {
          // Hide all panels
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
          // Show selected panel
          document.getElementById('panel-' + tab).classList.remove('hidden');
          
          // Update tab styles
          document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('border-emerald-500', 'text-emerald-600');
            btn.classList.add('border-transparent', 'text-gray-500');
          });
          document.getElementById('tab-' + tab).classList.remove('border-transparent', 'text-gray-500');
          document.getElementById('tab-' + tab).classList.add('border-emerald-500', 'text-emerald-600');
        }

        function copyContent() {
          const content = document.getElementById('generated-content')?.innerText || '';
          navigator.clipboard.writeText(content).then(() => {
            alert('Content copied to clipboard!');
          });
        }
      </script>
    `,
  });
}
