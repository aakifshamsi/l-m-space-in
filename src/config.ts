import type { D1Database } from '@cloudflare/workers-types';
import type { KVNamespace } from '@cloudflare/workers-types';

// Site types for multi-site detection
export type SiteType = 'main' | 'edgy' | 'master';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  // Advertisement Environment Variables
  MONETAG_API_KEY?: string;
  ENABLE_ADS?: string;
  EDGYMEMES_INSTA_PROMO?: string;
  // Site Configuration
  SITE_URL?: string;
  MASTER_PANEL_URL?: string;
  EDGY_SITE_URL?: string;
  // Email Configuration
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  // Auth Configuration
  JWT_SECRET?: string;
  SESSION_SECRET?: string;
  // Ollama Configuration
  OLLAMA_ENDPOINT?: string;
  OLLAMA_MODEL?: string;
  // Cloudflare Workers AI
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  CF_WORKERS_AI_MODEL?: string;
  // Ollama Cloud
  OLLAMA_CLOUD_API_KEY?: string;
  OLLAMA_CLOUD_MODEL?: string;
  // OpenRouter (existing)
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  // BrowserBase for automation
  BROWSERBASE_API_KEY?: string;
  BROWSERBASE_EMAIL?: string;
  // WhatsApp Bot
  WHATSAPP_BUSINESS_API_KEY?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
}

export interface AppConfig {
  sessionSecret: string;
  jwtSecret: string;
  siteUrl: string;
  siteName: string;
  siteDescription: string;
  defaultRedirectType: '301' | '302';
  linksPerPage: number;
  aiProvider: string;
  // Advertisement Configuration
  monetagApiKey: string;
  enableAds: boolean;
  adsOnRedirects: boolean;
  edgymemesInstaPromo: boolean;
  // Multi-site
  siteType: SiteType;
  masterPanelUrl: string;
  edgySiteUrl: string;
  // Ollama
  ollamaEndpoint: string;
  ollamaModel: string;
}

// Edgy site configuration
export const EDGY_SITE_CONFIG = {
  name: 'Edgy Links',
  tagline: 'Links that hit different 😎',
  description: 'The edgy link shortener for the cool kids',
  colorScheme: {
    primary: '#FF6B35', // Orange
    secondary: '#1A365D', // Navy
    accent: '#FBD38D', // Gold
  },
  features: {
    maxLinks: 10,
    maxClicksPerMonth: 500,
    customDomains: false,
    analytics: 'basic',
    adsOnRedirect: true,
    interstitialAds: true,
  },
};

export const DEFAULT_CONFIG: AppConfig = {
  sessionSecret: 'default-secret-change-me',
  jwtSecret: 'default-jwt-secret-change-me',
  siteUrl: 'https://l.m-space.in',
  siteName: 'Muslim Space Link',
  siteDescription: 'Official link shortener for Muslim Space',
  defaultRedirectType: '302',
  linksPerPage: 20,
  aiProvider: 'none',
  // Advertisement Configuration — runtime values come from getConfig(env)
  monetagApiKey: '',
  enableAds: true,
  adsOnRedirects: true,
  edgymemesInstaPromo: true,
  // Multi-site
  siteType: 'main',
  masterPanelUrl: 'https://m-space.in',
  edgySiteUrl: 'https://edgy.frii.site',
  // Ollama
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3',
};

export interface EnvConfig {
  SESSION_SECRET?: string;
  JWT_SECRET?: string;
  SITE_URL?: string;
  SITE_NAME?: string;
  SITE_DESCRIPTION?: string;
  MONETAG_API_KEY?: string;
  ENABLE_ADS?: string;
  ADS_ON_REDIRECTS?: string;
  EDGYMEMES_INSTA_PROMO?: string;
  MASTER_PANEL_URL?: string;
  EDGY_SITE_URL?: string;
  OLLAMA_ENDPOINT?: string;
  OLLAMA_MODEL?: string;
  // Cloudflare Workers AI
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  CF_WORKERS_AI_MODEL?: string;
  // Ollama Cloud
  OLLAMA_CLOUD_API_KEY?: string;
  OLLAMA_CLOUD_MODEL?: string;
  // OpenRouter
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
}

// Detect site type from hostname
export function detectSiteType(hostname: string | undefined): SiteType {
  if (!hostname) return 'main';
  
  const lowerHost = hostname.toLowerCase();
  
  if (lowerHost === 'm-space.in' || lowerHost.endsWith('.m-space.in')) {
    return 'master';
  }
  
  if (lowerHost === 'edgy.frii.site' || lowerHost.endsWith('.edgy.frii.site') || lowerHost.endsWith('.frii.site')) {
    return 'edgy';
  }
  
  return 'main';
}

export function getConfig(env: EnvConfig, hostname?: string): AppConfig {
  const siteType = detectSiteType(hostname);
  
  return {
    sessionSecret: env.SESSION_SECRET || DEFAULT_CONFIG.sessionSecret,
    jwtSecret: env.JWT_SECRET || DEFAULT_CONFIG.jwtSecret,
    siteUrl: env.SITE_URL || DEFAULT_CONFIG.siteUrl,
    siteName: env.SITE_NAME || DEFAULT_CONFIG.siteName,
    siteDescription: env.SITE_DESCRIPTION || DEFAULT_CONFIG.siteDescription,
    defaultRedirectType: DEFAULT_CONFIG.defaultRedirectType,
    linksPerPage: DEFAULT_CONFIG.linksPerPage,
    aiProvider: DEFAULT_CONFIG.aiProvider,
    // Advertisement Configuration
    monetagApiKey: env.MONETAG_API_KEY || DEFAULT_CONFIG.monetagApiKey,
    enableAds: env.ENABLE_ADS !== 'false',
    adsOnRedirects: env.ADS_ON_REDIRECTS !== 'false',
    edgymemesInstaPromo: env.EDGYMEMES_INSTA_PROMO !== 'false',
    // Multi-site
    siteType,
    masterPanelUrl: env.MASTER_PANEL_URL || DEFAULT_CONFIG.masterPanelUrl,
    edgySiteUrl: env.EDGY_SITE_URL || DEFAULT_CONFIG.edgySiteUrl,
    // Ollama
    ollamaEndpoint: env.OLLAMA_ENDPOINT || DEFAULT_CONFIG.ollamaEndpoint,
    ollamaModel: env.OLLAMA_MODEL || DEFAULT_CONFIG.ollamaModel,
  };
}

// Get edgy-specific config
export function getEdgyConfig(): typeof EDGY_SITE_CONFIG {
  return { ...EDGY_SITE_CONFIG };
}

// User roles
export type UserRole = 'owner' | 'admin' | 'editor';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface Link {
  id: number;
  slug: string;
  custom_alias: string | null;
  url: string;
  title: string | null;
  description: string | null;
  redirect_type: '301' | '302';
  expires_at: string | null;
  max_clicks: number | null;
  is_active: number;
  ad_free: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface Click {
  id: number;
  link_id: number;
  referrer: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  clicked_at: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string | null;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  details: string | null;
  created_at: string;
}

// Handle (social media profile)
export interface Handle {
  id: number;
  platform: 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'other';
  handle: string;
  url: string;
  display_name: string | null;
  is_enabled: number;
  is_primary: number;
  created_at: string;
  updated_at: string;
}