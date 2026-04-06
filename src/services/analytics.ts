import type { Env, Click } from '../config';
import { createDbHelper } from '../db';

export interface ClickInput {
  link_id: number;
  referrer?: string;
  country?: string;
  city?: string;
  user_agent?: string;
}

export interface AnalyticsSummary {
  total_clicks: number;
  unique_clicks: number;
  last_clicked: string | null;
  top_referrers: { referrer: string; count: number }[];
  daily_clicks: { date: string; count: number }[];
}

export interface LinkAnalytics {
  total_clicks: number;
  unique_clicks: number;
  last_clicked: string | null;
  clicks_by_date: { date: string; count: number }[];
  clicks_by_referrer: { referrer: string; count: number }[];
  clicks_by_country: { country: string; count: number }[];
}

export function createAnalyticsService(db: ReturnType<typeof createDbHelper>, kv: Env['CACHE']) {
  // Track a click
  async function trackClick(input: ClickInput): Promise<void> {
    await db.run(
      `INSERT INTO clicks (link_id, referrer, country, city, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [input.link_id, input.referrer || null, input.country || null, input.city || null, input.user_agent || null]
    );

    // Update link's click count cache in KV
    const cacheKey = `clicks:${input.link_id}`;
    const currentCount = await kv.get(cacheKey);
    const newCount = currentCount ? parseInt(currentCount) + 1 : 1;
    await kv.put(cacheKey, newCount.toString(), { expirationTtl: 86400 }); // 24 hours
  }

  // Get click count from cache
  async function getClickCountFromCache(linkId: number): Promise<number | null> {
    const cacheKey = `clicks:${linkId}`;
    const cached = await kv.get(cacheKey);
    return cached ? parseInt(cached) : null;
  }

  // Get global analytics summary
  async function getGlobalSummary(days: number = 30): Promise<AnalyticsSummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total clicks
    const totalResult = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM clicks WHERE clicked_at >= ?',
      [startDate.toISOString()]
    );
    const total_clicks = totalResult?.count || 0;

    // Unique clicks (unique user agents + referrers as a proxy)
    const uniqueResult = await db.get<{ count: number }>(
      'SELECT COUNT(DISTINCT user_agent || referrer) as count FROM clicks WHERE clicked_at >= ?',
      [startDate.toISOString()]
    );
    const unique_clicks = uniqueResult?.count || 0;

    // Last clicked
    const lastClick = await db.get<{ clicked_at: string }>(
      'SELECT clicked_at FROM clicks ORDER BY clicked_at DESC LIMIT 1'
    );
    const last_clicked = lastClick?.clicked_at || null;

    // Top referrers
    const topReferrers = await db.all<{ referrer: string; count: number }>(
      `SELECT COALESCE(referrer, 'Direct') as referrer, COUNT(*) as count 
       FROM clicks WHERE clicked_at >= ? 
       GROUP BY referrer ORDER BY count DESC LIMIT 10`,
      [startDate.toISOString()]
    );

    // Daily clicks for chart
    const dailyClicks = await db.all<{ date: string; count: number }>(
      `SELECT DATE(clicked_at) as date, COUNT(*) as count 
       FROM clicks WHERE clicked_at >= ? 
       GROUP BY DATE(clicked_at) ORDER BY date`,
      [startDate.toISOString()]
    );

    return {
      total_clicks,
      unique_clicks,
      last_clicked,
      top_referrers: topReferrers,
      daily_clicks: dailyClicks,
    };
  }

  // Get link-specific analytics
  async function getLinkAnalytics(linkId: number, days: number = 30): Promise<LinkAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total clicks
    const totalResult = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM clicks WHERE link_id = ? AND clicked_at >= ?',
      [linkId, startDate.toISOString()]
    );
    const total_clicks = totalResult?.count || 0;

    // Unique clicks
    const uniqueResult = await db.get<{ count: number }>(
      'SELECT COUNT(DISTINCT user_agent || COALESCE(referrer, "")) as count FROM clicks WHERE link_id = ? AND clicked_at >= ?',
      [linkId, startDate.toISOString()]
    );
    const unique_clicks = uniqueResult?.count || 0;

    // Last clicked
    const lastClick = await db.get<{ clicked_at: string }>(
      'SELECT clicked_at FROM clicks WHERE link_id = ? ORDER BY clicked_at DESC LIMIT 1',
      [linkId]
    );
    const last_clicked = lastClick?.clicked_at || null;

    // Clicks by date
    const clicksByDate = await db.all<{ date: string; count: number }>(
      `SELECT DATE(clicked_at) as date, COUNT(*) as count 
       FROM clicks WHERE link_id = ? AND clicked_at >= ? 
       GROUP BY DATE(clicked_at) ORDER BY date`,
      [linkId, startDate.toISOString()]
    );

    // Clicks by referrer
    const clicksByReferrer = await db.all<{ referrer: string; count: number }>(
      `SELECT COALESCE(referrer, 'Direct') as referrer, COUNT(*) as count 
       FROM clicks WHERE link_id = ? AND clicked_at >= ? 
       GROUP BY referrer ORDER BY count DESC LIMIT 10`,
      [linkId, startDate.toISOString()]
    );

    // Clicks by country
    const clicksByCountry = await db.all<{ country: string; count: number }>(
      `SELECT COALESCE(country, 'Unknown') as country, COUNT(*) as count 
       FROM clicks WHERE link_id = ? AND clicked_at >= ? 
       GROUP BY country ORDER BY count DESC LIMIT 10`,
      [linkId, startDate.toISOString()]
    );

    return {
      total_clicks,
      unique_clicks,
      last_clicked,
      clicks_by_date: clicksByDate,
      clicks_by_referrer: clicksByReferrer,
      clicks_by_country: clicksByCountry,
    };
  }

  // Get recent clicks for a link
  async function getRecentClicks(linkId: number, limit: number = 100): Promise<Click[]> {
    return db.all<Click>(
      'SELECT * FROM clicks WHERE link_id = ? ORDER BY clicked_at DESC LIMIT ?',
      [linkId, limit]
    );
  }

  // Get global stats (all time)
  async function getGlobalStats(): Promise<{ total_links: number; active_links: number; total_clicks: number }> {
    const linksResult = await db.get<{ total: number; active: number }>(
      'SELECT COUNT(*) as total, SUM(is_active) as active FROM links'
    );

    const clicksResult = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM clicks'
    );

    return {
      total_links: linksResult?.total || 0,
      active_links: linksResult?.active || 0,
      total_clicks: clicksResult?.count || 0,
    };
  }

  return {
    trackClick,
    getClickCountFromCache,
    getGlobalSummary,
    getLinkAnalytics,
    getRecentClicks,
    getGlobalStats,
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;