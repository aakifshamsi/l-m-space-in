// ===============================================
// Auto Blog Service - AI-powered automatic blog post generation
// ===============================================

import { D1Database } from '@cloudflare/workers-types';
import { createAIService, type AIConfig } from './ai';

export interface AutoBlogPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category: string;
  source_topic: string | null;
  ai_model: string | null;
  status: 'draft' | 'generated' | 'scheduled' | 'published';
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogTopic {
  id: number;
  topic: string;
  category: string;
  frequency: string;
  last_generated: string | null;
  is_active: number;
}

export class AutoBlogService {
  constructor(private db: D1Database) {}

  // ===============================================
  // TOPIC MANAGEMENT
  // ===============================================

  async getActiveTopics(): Promise<BlogTopic[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM blog_topics WHERE is_active = 1 ORDER BY frequency DESC, last_generated ASC NULLS FIRST'
    );
    const results = await stmt.all<BlogTopic>();
    return results.results;
  }

  async getTopicForGeneration(): Promise<BlogTopic | null> {
    // Get the least recently generated active topic
    const stmt = this.db.prepare(`
      SELECT * FROM blog_topics 
      WHERE is_active = 1 
      ORDER BY last_generated ASC NULLS FIRST, RANDOM() 
      LIMIT 1
    `);
    return stmt.first<BlogTopic>() as Promise<BlogTopic | null>;
  }

  async markTopicGenerated(topicId: number): Promise<void> {
    const stmt = this.db.prepare(
      'UPDATE blog_topics SET last_generated = CURRENT_TIMESTAMP WHERE id = ?'
    );
    await stmt.bind(topicId).run();
  }

  async addTopic(topic: string, category: string, frequency: string = 'weekly'): Promise<number> {
    const stmt = this.db.prepare(
      'INSERT INTO blog_topics (topic, category, frequency) VALUES (?, ?, ?)'
    );
    const result = await stmt.bind(topic, category, frequency).run();
    return result.meta.last_row_id as number;
  }

  async toggleTopic(topicId: number, active: boolean): Promise<void> {
    const stmt = this.db.prepare(
      'UPDATE blog_topics SET is_active = ? WHERE id = ?'
    );
    await stmt.bind(active ? 1 : 0, topicId).run();
  }

  async deleteTopic(topicId: number): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM blog_topics WHERE id = ?');
    await stmt.bind(topicId).run();
  }

  // ===============================================
  // POST GENERATION
  // ===============================================

  async generatePost(topic: BlogTopic, aiConfig: AIConfig): Promise<{ success: boolean; post?: AutoBlogPost; error?: string }> {
    const service = createAIService(aiConfig);
    
    if (!service.isConfigured) {
      return { success: false, error: 'AI is not configured. Please set up AI in settings.' };
    }

    // Build the generation prompt
    const prompt = this.buildPrompt(topic.topic, topic.category);
    
    // Generate content
    const response = await service.generate(prompt);
    
    if (!response.success || !response.content) {
      return { success: false, error: response.error || 'Failed to generate content' };
    }

    // Parse the generated content
    const parsed = this.parseGeneratedContent(response.content, topic.topic);
    
    // Create the post
    const slug = this.generateSlug(parsed.title);
    
    const stmt = this.db.prepare(`
      INSERT INTO auto_blog_posts (
        title, slug, content, excerpt, category, source_topic, 
        generation_prompt, ai_model, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generated')
    `);

    const result = await stmt.bind(
      parsed.title,
      slug,
      parsed.content,
      parsed.excerpt,
      topic.category,
      topic.topic,
      prompt,
      response.model || null
    ).run();

    // Mark the topic as generated
    await this.markTopicGenerated(topic.id);

    const post = await this.getPostById(result.meta.last_row_id as number);
    return { success: true, post: post! };
  }

  private buildPrompt(topic: string, category: string): string {
    const categoryContext: Record<string, string> = {
      'tutorials': 'Provide practical, step-by-step guidance that readers can follow easily.',
      'product-updates': 'Inform readers about new features, improvements, or changes. Be clear and concise.',
      'tech-news': 'Cover recent developments in the URL shortening and link management space.',
      'business': 'Focus on how businesses can leverage the technology for growth and efficiency.',
      'security': 'Emphasize safe practices and potential risks to watch out for.',
      'analytics': 'Explain how to interpret data and make informed decisions.',
      'marketing': 'Discuss branding, campaigns, and reaching audiences effectively.',
      'general': 'Create engaging, informative content that appeals to a broad audience.'
    };

    const context = categoryContext[category] || categoryContext.general;

    return `Write a blog post about: ${topic}

Context: ${context}

Requirements:
- Tone: Professional but friendly and approachable
- Length: 400-600 words
- Format: HTML with proper tags (<h2> for headers, <p> for paragraphs)
- Include a compelling introduction that hooks the reader
- Use 2-3 main sections with clear headers
- End with a conclusion and call-to-action
- Make it valuable and actionable for readers

Structure the response as:
TITLE: [Your compelling post title]
EXCERPT: [A 1-2 sentence summary for the article preview]
---
[Full HTML content starting with the article body]`;
  }

  private parseGeneratedContent(content: string, originalTopic: string): { title: string; excerpt: string; content: string } {
    // Try to extract title and excerpt from structured format
    const titleMatch = content.match(/TITLE:\s*(.+?)(?:\n|$)/i);
    const excerptMatch = content.match(/EXCERPT:\s*(.+?)(?:\n|$)/i);
    
    // Remove the structured parts from content
    let cleanContent = content
      .replace(/TITLE:\s*.+?(?:\n|$)/i, '')
      .replace(/EXCERPT:\s*.+?(?:\n|^)---/i, '')
      .trim();

    return {
      title: titleMatch?.[1]?.trim() || `Exploring ${originalTopic}`,
      excerpt: excerptMatch?.[1]?.trim() || cleanContent.substring(0, 150) + '...',
      content: cleanContent
    };
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80) + '-' + Date.now().toString(36);
  }

  // ===============================================
  // POST MANAGEMENT
  // ===============================================

  async getPostById(id: number): Promise<AutoBlogPost | null> {
    const stmt = this.db.prepare('SELECT * FROM auto_blog_posts WHERE id = ?');
    return stmt.bind(id).first<AutoBlogPost>() as Promise<AutoBlogPost | null>;
  }

  async getPostBySlug(slug: string): Promise<AutoBlogPost | null> {
    const stmt = this.db.prepare('SELECT * FROM auto_blog_posts WHERE slug = ?');
    return stmt.bind(slug).first<AutoBlogPost>() as Promise<AutoBlogPost | null>;
  }

  async listPosts(options: {
    status?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ posts: AutoBlogPost[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (options.status) {
      conditions.push('status = ?');
      values.push(options.status);
    }

    if (options.category) {
      conditions.push('category = ?');
      values.push(options.category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM auto_blog_posts ${whereClause}`);
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const stmt = this.db.prepare(`
      SELECT * FROM auto_blog_posts 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<AutoBlogPost>();

    return {
      posts: results.results,
      total: countResult?.total || 0
    };
  }

  async getPublishedPosts(options: {
    category?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ posts: AutoBlogPost[]; total: number }> {
    return this.listPosts({
      status: 'published',
      category: options.category,
      page: options.page,
      pageSize: options.pageSize
    });
  }

  async updatePost(id: number, data: {
    title?: string;
    content?: string;
    excerpt?: string;
    category?: string;
  }): Promise<AutoBlogPost> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
      // Update slug when title changes
      fields.push('slug = ?');
      values.push(this.generateSlug(data.title));
    }
    if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
    if (data.excerpt !== undefined) { fields.push('excerpt = ?'); values.push(data.excerpt); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }

    if (fields.length === 0) {
      return this.getPostById(id) as Promise<AutoBlogPost>;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`UPDATE auto_blog_posts SET ${fields.join(', ')} WHERE id = ?`);
    await stmt.bind(...values).run();

    return this.getPostById(id) as Promise<AutoBlogPost>;
  }

  async schedulePost(id: number, scheduledAt: string): Promise<AutoBlogPost> {
    const stmt = this.db.prepare(`
      UPDATE auto_blog_posts 
      SET status = 'scheduled', scheduled_at = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    await stmt.bind(scheduledAt, id).run();
    return this.getPostById(id) as Promise<AutoBlogPost>;
  }

  async publishPost(id: number): Promise<AutoBlogPost> {
    const stmt = this.db.prepare(`
      UPDATE auto_blog_posts 
      SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    await stmt.bind(id).run();
    return this.getPostById(id) as Promise<AutoBlogPost>;
  }

  async unpublishPost(id: number): Promise<AutoBlogPost> {
    const stmt = this.db.prepare(`
      UPDATE auto_blog_posts 
      SET status = 'draft', published_at = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    await stmt.bind(id).run();
    return this.getPostById(id) as Promise<AutoBlogPost>;
  }

  async deletePost(id: number): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM auto_blog_posts WHERE id = ?');
    await stmt.bind(id).run();
  }

  async regeneratePost(id: number, aiConfig: AIConfig): Promise<{ success: boolean; post?: AutoBlogPost; error?: string }> {
    const post = await this.getPostById(id);
    if (!post || !post.source_topic) {
      return { success: false, error: 'Post not found or has no source topic' };
    }

    // Get the topic
    const topics = await this.getActiveTopics();
    const topic = topics.find(t => t.topic === post.source_topic);
    if (!topic) {
      return { success: false, error: 'Original topic no longer available' };
    }

    // Delete the old post
    await this.deletePost(id);

    // Generate a new one
    return this.generatePost(topic, aiConfig);
  }

  // ===============================================
  // SCHEDULED POSTS PROCESSING
  // ===============================================

  async processScheduledPosts(): Promise<number> {
    // Get all scheduled posts that are due
    const stmt = this.db.prepare(`
      SELECT * FROM auto_blog_posts 
      WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP
    `);
    const posts = await stmt.all<AutoBlogPost>();

    for (const post of posts.results) {
      await this.publishPost(post.id);
    }

    return posts.results.length;
  }

  // ===============================================
  // SETTINGS
  // ===============================================

  async isAutoBlogEnabled(): Promise<boolean> {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = await stmt.bind('auto_blog_enabled').first<{ value: string }>();
    return result?.value === 'true';
  }

  async getAutoBlogFrequency(): Promise<string> {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = await stmt.bind('auto_blog_frequency').first<{ value: string }>();
    return result?.value || 'weekly';
  }

  async setAutoBlogEnabled(enabled: boolean): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
    );
    await stmt.bind('auto_blog_enabled', enabled ? 'true' : 'false').run();
  }

  // ===============================================
  // DASHBOARD STATS
  // ===============================================

  async getDashboardStats(): Promise<{
    total_posts: number;
    published: number;
    scheduled: number;
    drafts: number;
    last_generated: string | null;
  }> {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM auto_blog_posts');
    const totalResult = await totalStmt.first<{ count: number }>();

    const publishedStmt = this.db.prepare("SELECT COUNT(*) as count FROM auto_blog_posts WHERE status = 'published'");
    const publishedResult = await publishedStmt.first<{ count: number }>();

    const scheduledStmt = this.db.prepare("SELECT COUNT(*) as count FROM auto_blog_posts WHERE status = 'scheduled'");
    const scheduledResult = await scheduledStmt.first<{ count: number }>();

    const draftStmt = this.db.prepare("SELECT COUNT(*) as count FROM auto_blog_posts WHERE status IN ('draft', 'generated')");
    const draftResult = await draftStmt.first<{ count: number }>();

    const lastStmt = this.db.prepare('SELECT created_at FROM auto_blog_posts ORDER BY created_at DESC LIMIT 1');
    const lastResult = await lastStmt.first<{ created_at: string }>();

    return {
      total_posts: totalResult?.count || 0,
      published: publishedResult?.count || 0,
      scheduled: scheduledResult?.count || 0,
      drafts: draftResult?.count || 0,
      last_generated: lastResult?.created_at || null
    };
  }
}

export default AutoBlogService;
