// AI Service with Ollama, OpenRouter, Ollama Cloud, and Cloudflare Workers AI integration
// Provider priority:
// 1. Cloudflare Workers AI (fastest, edge-native)
// 2. Ollama Cloud (hosted Ollama API)
// 3. OpenRouter (unified API for multiple models)
// 4. Ollama local/self-hosted (fallback)

import type { DbHelper } from '../db';

// API endpoints
const OLLAMA_CLOUD_API = 'https://api.ollama.ai/v1/chat/completions';

export type AIProvider = 'none' | 'openrouter' | 'ollama' | 'ollama-cloud' | 'cf-workers-ai';
export type AIFeatureType = 'blog_content' | 'social_caption' | 'link_description' | 'hashtag_suggestion';

export interface AIConfig {
  provider: AIProvider;
  enabled: boolean;
  // Ollama local/self-hosted
  ollamaEndpoint: string;
  ollamaModel: string;
  // OpenRouter
  openrouterApiKey: string;
  openrouterModel: string;
  // Ollama Cloud
  ollamaCloudApiKey: string;
  ollamaCloudModel: string;
  // Cloudflare Workers AI
  cfAccountId: string;
  cfApiToken: string;
  cfWorkersAiModel: string;
}

export interface AIResponse {
  content: string;
  success: boolean;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

export interface OllamaStatus {
  available: boolean;
  endpoint: string;
  model: string;
  models?: string[];
  error?: string;
}

export interface ContentGenerationOptions {
  topic?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'humorous' | 'informative';
  length?: 'short' | 'medium' | 'long';
  format?: 'plain' | 'html' | 'markdown';
}

// Default AI configuration
export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'none',
  enabled: false,
  // Ollama local/self-hosted
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3',
  // OpenRouter
  openrouterApiKey: '',
  openrouterModel: 'anthropic/claude-3-haiku',
  // Ollama Cloud
  ollamaCloudApiKey: '',
  ollamaCloudModel: 'llama3',
  // Cloudflare Workers AI
  cfAccountId: '',
  cfApiToken: '',
  cfWorkersAiModel: '@cf/meta/llama-3-8b-instruct',
};

// Load AI config from settings
export function loadAIConfig(settings: Record<string, string>): AIConfig {
  return {
    provider: (settings.ai_provider as AIProvider) || 'none',
    enabled: settings.ai_enabled === 'true',
    // Ollama local/self-hosted
    ollamaEndpoint: settings.ai_ollama_endpoint || DEFAULT_AI_CONFIG.ollamaEndpoint,
    ollamaModel: settings.ai_ollama_model || DEFAULT_AI_CONFIG.ollamaModel,
    // OpenRouter
    openrouterApiKey: settings.ai_openrouter_api_key || '',
    openrouterModel: settings.ai_openrouter_model || DEFAULT_AI_CONFIG.openrouterModel,
    // Ollama Cloud
    ollamaCloudApiKey: settings.ai_ollama_cloud_api_key || '',
    ollamaCloudModel: settings.ai_ollama_cloud_model || DEFAULT_AI_CONFIG.ollamaCloudModel,
    // Cloudflare Workers AI
    cfAccountId: settings.ai_cf_account_id || '',
    cfApiToken: settings.ai_cf_api_token || '',
    cfWorkersAiModel: settings.ai_cf_workers_ai_model || DEFAULT_AI_CONFIG.cfWorkersAiModel,
  };
}

// Check Ollama status and availability
export async function checkOllamaStatus(endpoint: string): Promise<OllamaStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout for health check

    // First check if Ollama is reachable
    const healthResponse = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!healthResponse.ok) {
      return {
        available: false,
        endpoint,
        model: '',
        error: `Ollama returned status ${healthResponse.status}`,
      };
    }

    const data = await healthResponse.json() as { models?: Array<{ name: string }> };
    
    return {
      available: true,
      endpoint,
      model: '',
      models: data.models?.map(m => m.name) || [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Common error handling
    if (message.includes('aborted')) {
      return {
        available: false,
        endpoint,
        model: '',
        error: 'Connection timeout - Ollama may not be running',
      };
    }
    
    return {
      available: false,
      endpoint,
      model: '',
      error: message,
    };
  }
}

// Verify Ollama model works
export async function verifyOllamaModel(endpoint: string, model: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await generateWithOllamaTest(endpoint, model, 'Hello, respond with just "OK"');
    
    if (response.success && response.content.toLowerCase().includes('ok')) {
      return { success: true };
    }
    
    return { success: false, error: response.error || 'Model did not respond correctly' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Test function for Ollama
async function generateWithOllamaTest(endpoint: string, model: string, prompt: string): Promise<AIResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        content: '',
        success: false,
        error: `Ollama error: ${response.status}`,
      };
    }

    const data = await response.json() as { response?: string; error?: string };
    
    if (data.error) {
      return {
        content: '',
        success: false,
        error: data.error,
      };
    }

    return {
      content: data.response || '',
      success: true,
      model,
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Ollama error',
    };
  }
}

// Create AI service instance
export function createAIService(config: AIConfig) {
  const { 
    provider, 
    enabled, 
    ollamaEndpoint, 
    ollamaModel, 
    openrouterApiKey, 
    openrouterModel,
    ollamaCloudApiKey,
    ollamaCloudModel,
    cfAccountId,
    cfApiToken,
    cfWorkersAiModel
  } = config;

  async function generate(prompt: string, _options?: ContentGenerationOptions): Promise<AIResponse> {
    if (!enabled) {
      return {
        content: '',
        success: false,
        error: 'AI features are disabled. Enable AI in settings.',
      };
    }

    // Priority order for provider selection:
    // 1. Cloudflare Workers AI (fastest, edge-native)
    // 2. Ollama Cloud (hosted API)
    // 3. OpenRouter (unified API)
    // 4. Ollama local/self-hosted (fallback)

    // Try Cloudflare Workers AI first
    if (cfAccountId && cfApiToken) {
      const response = await generateWithCloudflareAI(prompt, cfAccountId, cfApiToken, cfWorkersAiModel);
      if (response.success) return response;
      console.log('CF Workers AI failed, trying next provider...');
    }

    // Try Ollama Cloud
    if (ollamaCloudApiKey) {
      const response = await generateWithOllamaCloud(prompt, ollamaCloudApiKey, ollamaCloudModel);
      if (response.success) return response;
      console.log('Ollama Cloud failed, trying next provider...');
    }

    // Try OpenRouter
    if (openrouterApiKey) {
      const response = await generateWithOpenRouter(prompt, openrouterApiKey, openrouterModel);
      if (response.success) return response;
      console.log('OpenRouter failed, trying next provider...');
    }

    // Fallback to local Ollama
    if (provider === 'ollama' && ollamaEndpoint) {
      const response = await generateWithOllama(prompt, ollamaEndpoint, ollamaModel);
      if (response.success) return response;
    }

    return {
      content: '',
      success: false,
      error: 'No AI provider configured or available.',
    };
  }

  async function generateWithOllama(
    prompt: string,
    endpoint: string,
    model: string
  ): Promise<AIResponse> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ollama error:', errorText);
        return {
          content: '',
          success: false,
          error: `Ollama error: ${response.status}`,
        };
      }

      const data = await response.json() as { response?: string; error?: string };
      
      if (data.error) {
        return {
          content: '',
          success: false,
          error: data.error,
        };
      }

      return {
        content: data.response || '',
        success: true,
        model,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Ollama error';
      console.error('Ollama request failed:', message);
      return {
        content: '',
        success: false,
        error: message,
      };
    }
  }

  async function generateWithOpenRouter(
    prompt: string,
    apiKey: string,
    model: string
  ): Promise<AIResponse> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://l.m-space.in',
          'X-Title': 'M-Space Link',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
        console.error('OpenRouter error:', errorData);
        return {
          content: '',
          success: false,
          error: errorData.error?.message || `OpenRouter error: ${response.status}`,
        };
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const content = data.choices?.[0]?.message?.content || '';

      return {
        content,
        success: true,
        model,
        usage: data.usage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown OpenRouter error';
      console.error('OpenRouter request failed:', message);
      return {
        content: '',
        success: false,
        error: message,
      };
    }
  }

  // Generate with Cloudflare Workers AI (fastest, edge-native)
  async function generateWithCloudflareAI(
    prompt: string,
    accountId: string,
    apiToken: string,
    model: string
  ): Promise<AIResponse> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { errors?: string[] };
        console.error('Cloudflare Workers AI error:', errorData);
        return {
          content: '',
          success: false,
          error: errorData.errors?.[0] || `CF Workers AI error: ${response.status}`,
        };
      }

      const data = await response.json() as { result?: { response?: string } };
      
      return {
        content: data.result?.response || '',
        success: true,
        model,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown CF Workers AI error';
      console.error('Cloudflare Workers AI request failed:', message);
      return {
        content: '',
        success: false,
        error: message,
      };
    }
  }

  // Generate with Ollama Cloud (hosted API)
  async function generateWithOllamaCloud(
    prompt: string,
    apiKey: string,
    model: string
  ): Promise<AIResponse> {
    try {
      const response = await fetch(OLLAMA_CLOUD_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'llama3',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
        console.error('Ollama Cloud error:', errorData);
        return {
          content: '',
          success: false,
          error: errorData.error?.message || `Ollama Cloud error: ${response.status}`,
        };
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const content = data.choices?.[0]?.message?.content || '';

      return {
        content,
        success: true,
        model,
        usage: data.usage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Ollama Cloud error';
      console.error('Ollama Cloud request failed:', message);
      return {
        content: '',
        success: false,
        error: message,
      };
    }
  }

  return {
    generate,
    generateWithOllama,
    generateWithOpenRouter,
    generateWithCloudflareAI,
    generateWithOllamaCloud,
    config: { provider, enabled },
    isConfigured: provider !== 'none' && enabled,
  };
}

// Generate blog content with topic, tone, and length options
export async function generateBlogContent(
  config: AIConfig,
  topic: string,
  options: ContentGenerationOptions = {}
): Promise<AIResponse> {
  const { tone = 'professional', length = 'medium', format = 'markdown' } = options;
  
  const lengthWords = {
    short: '150-200 words',
    medium: '300-400 words',
    long: '600-800 words',
  }[length];

  const prompt = `Write a blog post about: ${topic}

Requirements:
- Tone: ${tone}
- Length: approximately ${lengthWords}
- Format: ${format === 'html' ? 'HTML with proper tags' : format === 'markdown' ? 'Markdown format' : 'Plain text'}

Write an engaging, well-structured post with:
- An attention-grabbing introduction
- 2-3 main sections with headers
- A conclusion with a call to action

${format === 'html' ? 'Use <h2> for headers, <p> for paragraphs.' : ''}`;

  const service = createAIService(config);
  return service.generate(prompt, options);
}

// Generate social media caption for a URL/link
export async function generateSocialCaption(
  config: AIConfig,
  url: string,
  title: string,
  platform: 'twitter' | 'facebook' | 'instagram' | 'linkedin' = 'twitter'
): Promise<AIResponse> {
  const platformGuides: Record<string, string> = {
    twitter: 'Under 280 characters, engaging, with relevant hashtags',
    facebook: '1-2 sentences, conversational, with emoji, include call-to-action',
    instagram: 'Catchy, with relevant hashtags, story-style caption',
    linkedin: 'Professional, thought-provoking, industry-relevant',
  };

  const prompt = `Generate a ${platform} caption for this content:

Title: ${title}
URL: ${url}

Requirements:
- ${platformGuides[platform]}
- Make it engaging and shareable
- Include appropriate emoji where suitable
- Include 2-5 relevant hashtags for ${platform}`;

  const service = createAIService(config);
  return service.generate(prompt);
}

// Generate link description
export async function generateLinkDescription(
  config: AIConfig,
  url: string,
  title: string
): Promise<AIResponse> {
  const prompt = `Generate a concise, descriptive summary (50-100 words) for a shortened link:

Title: ${title}
URL: ${url}

Create a brief, informative description that:
- Accurately describes the content
- Is engaging and click-worthy
- Works well as link metadata/description`;

  const service = createAIService(config);
  return service.generate(prompt);
}

// Get available providers for UI
export function getAvailableProviders(): { id: AIProvider; name: string; description: string }[] {
  return [
    { id: 'none', name: 'None', description: 'Disable AI features' },
    { id: 'ollama', name: 'Ollama Local', description: 'Self-hosted LLM (local/cloud server)' },
    { id: 'ollama-cloud', name: 'Ollama Cloud', description: 'Hosted Ollama API (ollama.ai)' },
    { id: 'cf-workers-ai', name: 'Cloudflare Workers AI', description: 'Edge-native AI on Cloudflare network' },
    { id: 'openrouter', name: 'OpenRouter', description: 'Unified API for multiple AI models' },
  ];
}

// Track AI usage
export async function trackUsage(
  db: DbHelper,
  userId: number,
  featureType: AIFeatureType,
  creditsUsed: number,
  metadata?: { model?: string; promptTokens?: number; completionTokens?: number }
): Promise<void> {
  await db.run(
    `INSERT INTO ai_usage (user_id, feature_type, credits_used, model_used, prompt_tokens, completion_tokens)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, featureType, creditsUsed, metadata?.model || null, metadata?.promptTokens || null, metadata?.completionTokens || null]
  );
}

export type AIService = ReturnType<typeof createAIService>;
