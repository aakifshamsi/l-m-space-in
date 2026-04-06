// AI Trial Service - Manages 30-day trials for AI features
// Handles trial creation, credit management, and usage tracking

import type { DbHelper } from '../db';
import type { AIFeatureType } from './ai';

export interface AISubscription {
  id: number;
  user_id: number;
  plan_type: 'trial' | 'free' | 'pro' | 'enterprise';
  trial_start: string | null;
  trial_end: string | null;
  credits_remaining: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface TrialStatus {
  hasActiveTrial: boolean;
  daysRemaining: number;
  creditsRemaining: number;
  isExpired: boolean;
  subscription: AISubscription | null;
}

export interface CanUseResult {
  allowed: boolean;
  reason?: string;
  creditsRemaining?: number;
  daysRemaining?: number;
}

const TRIAL_DAYS = 30;
const TRIAL_CREDITS = 100;

// Credits cost per feature type
const FEATURE_CREDITS: Record<AIFeatureType, number> = {
  blog_content: 3,
  social_caption: 1,
  link_description: 1,
  hashtag_suggestion: 1,
};

export function createAITrialService(db: DbHelper) {
  // Get subscription for a user
  async function getSubscription(userId: number): Promise<AISubscription | null> {
    return db.get<AISubscription>(
      `SELECT * FROM ai_subscriptions WHERE user_id = ? AND is_active = 1 LIMIT 1`,
      [userId]
    );
  }

  // Check if user has an active trial
  async function getTrialStatus(userId: number): Promise<TrialStatus> {
    const subscription = await getSubscription(userId);

    if (!subscription) {
      return {
        hasActiveTrial: false,
        daysRemaining: 0,
        creditsRemaining: 0,
        isExpired: true,
        subscription: null,
      };
    }

    const now = new Date();
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
    const isExpired = trialEnd ? now > trialEnd : false;
    
    const daysRemaining = trialEnd 
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      hasActiveTrial: !isExpired && subscription.is_active === 1,
      daysRemaining,
      creditsRemaining: subscription.credits_remaining,
      isExpired,
      subscription,
    };
  }

  // Create a new trial for a user
  async function createTrial(userId: number): Promise<AISubscription> {
    // Check if user already has a subscription
    const existing = await getSubscription(userId);
    
    if (existing) {
      // If there's an existing active trial, don't create a new one
      if (existing.plan_type === 'trial' && existing.is_active === 1) {
        const now = new Date();
        const trialEnd = existing.trial_end ? new Date(existing.trial_end) : null;
        if (!trialEnd || now < trialEnd) {
          return existing;
        }
      }
      
      // Deactivate old subscription if exists
      await db.run(
        `UPDATE ai_subscriptions SET is_active = 0, updated_at = datetime('now') WHERE user_id = ?`,
        [userId]
      );
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const result = await db.run(
      `INSERT INTO ai_subscriptions (user_id, plan_type, trial_start, trial_end, credits_remaining, is_active)
       VALUES (?, 'trial', ?, ?, ?, 1)`,
      [userId, now.toISOString(), trialEnd.toISOString(), TRIAL_CREDITS]
    );

    return {
      id: result.lastInsertRowid || 0,
      user_id: userId,
      plan_type: 'trial',
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      credits_remaining: TRIAL_CREDITS,
      is_active: 1,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  // Check if user can use AI features
  async function canUseAi(userId: number): Promise<CanUseResult> {
    const status = await getTrialStatus(userId);

    if (!status.hasActiveTrial) {
      return {
        allowed: false,
        reason: 'No active trial. Start a free 30-day trial to use AI features.',
      };
    }

    if (status.isExpired) {
      return {
        allowed: false,
        reason: 'Your trial has expired. AI features are no longer available.',
      };
    }

    if (status.creditsRemaining <= 0) {
      return {
        allowed: false,
        reason: 'No credits remaining. Daily credits reset at midnight.',
        daysRemaining: status.daysRemaining,
      };
    }

    return {
      allowed: true,
      creditsRemaining: status.creditsRemaining,
      daysRemaining: status.daysRemaining,
    };
  }

  // Deduct credit for a feature usage
  async function deductCredit(userId: number, featureType: AIFeatureType): Promise<boolean> {
    const canUse = await canUseAi(userId);
    
    if (!canUse.allowed) {
      return false;
    }

    const creditsNeeded = FEATURE_CREDITS[featureType] || 1;
    
    if ((canUse.creditsRemaining || 0) < creditsNeeded) {
      return false;
    }

    await db.run(
      `UPDATE ai_subscriptions 
       SET credits_remaining = credits_remaining - ?, updated_at = datetime('now')
       WHERE user_id = ? AND is_active = 1`,
      [creditsNeeded, userId]
    );

    return true;
  }

  // Get credits cost for a feature
  function getFeatureCost(featureType: AIFeatureType): number {
    return FEATURE_CREDITS[featureType] || 1;
  }

  // Reset daily credits (called by cron or on-demand)
  async function resetDailyCredits(): Promise<number> {
    const now = new Date();
    
    // Reset credits for active subscriptions where trial hasn't ended
    const result = await db.run(
      `UPDATE ai_subscriptions 
       SET credits_remaining = COALESCE(
         (SELECT value FROM settings WHERE key = 'ai_trial_credits'), ?
       ), updated_at = datetime('now')
       WHERE is_active = 1 
       AND (trial_end IS NULL OR datetime(trial_end) > datetime(?))`,
      [TRIAL_CREDITS, now.toISOString()]
    );

    return result.changes || 0;
  }

  // Get usage statistics for a user
  async function getUsageStats(userId: number, days: number = 7): Promise<{
    totalUsage: number;
    todayUsage: number;
    featureBreakdown: Record<string, number>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await db.all<{ feature_type: string; credits_used: number; created_at: string }>(
      `SELECT feature_type, credits_used, created_at 
       FROM ai_usage 
       WHERE user_id = ? AND datetime(created_at) >= datetime(?)`,
      [userId, startDate.toISOString()]
    );

    const todayUsage = usage
      .filter(u => new Date(u.created_at) >= today)
      .reduce((sum, u) => sum + u.credits_used, 0);

    const featureBreakdown: Record<string, number> = {};
    for (const u of usage) {
      featureBreakdown[u.feature_type] = (featureBreakdown[u.feature_type] || 0) + u.credits_used;
    }

    return {
      totalUsage: usage.reduce((sum, u) => sum + u.credits_used, 0),
      todayUsage,
      featureBreakdown,
    };
  }

  // Get default trial settings
  function getTrialDefaults(): { days: number; credits: number } {
    return {
      days: TRIAL_DAYS,
      credits: TRIAL_CREDITS,
    };
  }

  return {
    getSubscription,
    getTrialStatus,
    createTrial,
    canUseAi,
    deductCredit,
    getFeatureCost,
    resetDailyCredits,
    getUsageStats,
    getTrialDefaults,
  };
}

export type AITrialService = ReturnType<typeof createAITrialService>;
