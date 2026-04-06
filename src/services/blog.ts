// ===============================================
// Blog Service - Manages blog submissions and content
// ===============================================

import { D1Database } from '@cloudflare/workers-types';
import type { 
  BlogSubmission, 
  BlogSubmissionWithAuthor,
  CreateBlogSubmissionInput,
  ReviewBlogInput,
  BlogDashboardStats
} from '../types/forms-automation';

export class BlogService {
  constructor(private db: D1Database) {}

  // ===============================================
  // BLOG SUBMISSION CRUD
  // ===============================================

  async submitArticle(siteId: number | null, input: CreateBlogSubmissionInput, userId?: number): Promise<BlogSubmission> {
    // Generate slug from title
    const slug = this.generateSlug(input.title);

    const stmt = this.db.prepare(`
      INSERT INTO blog_submissions (
        site_id, user_id, author_name, author_email, title, slug,
        content, excerpt, featured_image, category, tags, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const result = await stmt.bind(
      siteId,
      userId || null,
      input.author_name || null,
      input.author_email || null,
      input.title,
      slug,
      input.content,
      input.excerpt || null,
      input.featured_image || null,
      input.category || null,
      input.tags ? JSON.stringify(input.tags) : null
    ).run();

    return this.getSubmissionById(result.meta.last_row_id as number) as Promise<BlogSubmission>;
  }

  async getSubmissionById(id: number): Promise<BlogSubmission | null> {
    const stmt = this.db.prepare('SELECT * FROM blog_submissions WHERE id = ?');
    const result = await stmt.bind(id).first<BlogSubmission & { tags: string }>();
    
    if (!result) return null;

    return {
      ...result,
      tags: result.tags ? JSON.parse(result.tags) : null
    };
  }

  async getSubmissionBySlug(slug: string): Promise<BlogSubmission | null> {
    const stmt = this.db.prepare('SELECT * FROM blog_submissions WHERE slug = ?');
    const result = await stmt.bind(slug).first<BlogSubmission & { tags: string }>();
    
    if (!result) return null;

    return {
      ...result,
      tags: result.tags ? JSON.parse(result.tags) : null
    };
  }

  async updateSubmission(id: number, input: Partial<CreateBlogSubmissionInput>): Promise<BlogSubmission> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) { 
      fields.push('title = ?'); 
      values.push(input.title);
      // Update slug when title changes
      fields.push('slug = ?');
      values.push(this.generateSlug(input.title));
    }
    if (input.content !== undefined) { fields.push('content = ?'); values.push(input.content); }
    if (input.excerpt !== undefined) { fields.push('excerpt = ?'); values.push(input.excerpt); }
    if (input.featured_image !== undefined) { fields.push('featured_image = ?'); values.push(input.featured_image); }
    if (input.category !== undefined) { fields.push('category = ?'); values.push(input.category); }
    if (input.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(input.tags)); }

    if (fields.length === 0) {
      return this.getSubmissionById(id) as Promise<BlogSubmission>;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`UPDATE blog_submissions SET ${fields.join(', ')} WHERE id = ?`);
    await stmt.bind(...values).run();

    return this.getSubmissionById(id) as Promise<BlogSubmission>;
  }

  // ===============================================
  // BLOG REVIEW/MODERATION
  // ===============================================

  async reviewSubmission(id: number, input: ReviewBlogInput, reviewedBy: number): Promise<BlogSubmission> {
    const submission = await this.getSubmissionById(id);
    if (!submission) {
      throw new Error('Submission not found');
    }

    const publishedAt = input.status === 'approved' && input.publish_now 
      ? new Date().toISOString() 
      : input.status === 'approved' 
        ? submission.published_at 
        : null;

    const newStatus = input.status === 'approved' && input.publish_now ? 'published' : input.status;

    const stmt = this.db.prepare(`
      UPDATE blog_submissions 
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, 
          review_notes = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    await stmt.bind(
      newStatus,
      reviewedBy,
      input.review_notes || null,
      publishedAt,
      id
    ).run();

    return this.getSubmissionById(id) as Promise<BlogSubmission>;
  }

  async publishSubmission(id: number): Promise<BlogSubmission> {
    const stmt = this.db.prepare(`
      UPDATE blog_submissions 
      SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'approved'
    `);

    const result = await stmt.bind(id).run();
    
    if (result.meta.changes === 0) {
      throw new Error('Submission must be approved before publishing');
    }

    return this.getSubmissionById(id) as Promise<BlogSubmission>;
  }

  async unpublishSubmission(id: number): Promise<BlogSubmission> {
    const stmt = this.db.prepare(`
      UPDATE blog_submissions 
      SET status = 'approved', published_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    await stmt.bind(id).run();
    return this.getSubmissionById(id) as Promise<BlogSubmission>;
  }

  // ===============================================
  // BLOG LISTING
  // ===============================================

  async listSubmissions(options: {
    siteId?: number;
    userId?: number;
    status?: BlogSubmission['status'];
    search?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ submissions: BlogSubmissionWithAuthor[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (options.siteId) {
      conditions.push('bs.site_id = ?');
      values.push(options.siteId);
    }

    if (options.userId) {
      conditions.push('bs.user_id = ?');
      values.push(options.userId);
    }

    if (options.status) {
      conditions.push('bs.status = ?');
      values.push(options.status);
    }

    if (options.search) {
      conditions.push('(bs.title LIKE ? OR bs.content LIKE ? OR bs.author_name LIKE ?)');
      const searchTerm = `%${options.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }

    if (options.category) {
      conditions.push('bs.category = ?');
      values.push(options.category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM blog_submissions bs ${whereClause}`);
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const stmt = this.db.prepare(`
      SELECT bs.*, u.name as reviewer_name
      FROM blog_submissions bs
      LEFT JOIN users u ON bs.reviewed_by = u.id
      ${whereClause}
      ORDER BY bs.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<BlogSubmissionWithAuthor & { tags: string }>();

    const submissions = results.results.map(s => ({
      ...s,
      tags: s.tags ? JSON.parse(s.tags) : null
    }));

    return {
      submissions,
      total: countResult?.total || 0
    };
  }

  async getPublishedArticles(options: {
    siteId?: number;
    category?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ articles: BlogSubmissionWithAuthor[]; total: number }> {
    const conditions: string[] = ["bs.status = 'published'"];
    const values: unknown[] = [];

    if (options.siteId) {
      conditions.push('bs.site_id = ?');
      values.push(options.siteId);
    }

    if (options.category) {
      conditions.push('bs.category = ?');
      values.push(options.category);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM blog_submissions bs ${whereClause}`);
    const countResult = await countStmt.bind(...values).first<{ total: number }>();

    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const offset = (page - 1) * pageSize;

    const stmt = this.db.prepare(`
      SELECT bs.*, u.name as reviewer_name
      FROM blog_submissions bs
      LEFT JOIN users u ON bs.reviewed_by = u.id
      ${whereClause}
      ORDER BY bs.published_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(...values, pageSize, offset).all<BlogSubmissionWithAuthor & { tags: string }>();

    const articles = results.results.map(s => ({
      ...s,
      tags: s.tags ? JSON.parse(s.tags) : null
    }));

    return {
      articles,
      total: countResult?.total || 0
    };
  }

  async getPendingReview(options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ submissions: BlogSubmissionWithAuthor[]; total: number }> {
    return this.listSubmissions({ status: 'pending', ...options });
  }

  // ===============================================
  // VIEW COUNT
  // ===============================================

  async incrementViewCount(id: number): Promise<void> {
    const stmt = this.db.prepare('UPDATE blog_submissions SET view_count = view_count + 1 WHERE id = ?');
    await stmt.bind(id).run();
  }

  // ===============================================
  // DASHBOARD STATS
  // ===============================================

  async getDashboardStats(siteId?: number): Promise<BlogDashboardStats> {
    const conditions = siteId ? 'WHERE site_id = ?' : '';
    const values = siteId ? [siteId] : [];

    // Total submissions
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM blog_submissions ${conditions}`);
    const totalResult = await totalStmt.bind(...values).first<{ count: number }>();

    // Pending review
    const pendingStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM blog_submissions ${conditions ? conditions + ' AND' : 'WHERE'} status = 'pending'`
    );
    const pendingResult = await pendingStmt.bind(...values).first<{ count: number }>();

    // Published articles
    const publishedStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM blog_submissions ${conditions ? conditions + ' AND' : 'WHERE'} status = 'published'`
    );
    const publishedResult = await publishedStmt.bind(...values).first<{ count: number }>();

    // Total views
    const viewsStmt = this.db.prepare(
      `SELECT COALESCE(SUM(view_count), 0) as views FROM blog_submissions ${conditions ? conditions + ' AND' : 'WHERE'} status = 'published'`
    );
    const viewsResult = await viewsStmt.bind(...values).first<{ views: number }>();

    return {
      total_submissions: totalResult?.count || 0,
      pending_review: pendingResult?.count || 0,
      published_articles: publishedResult?.count || 0,
      total_views: viewsResult?.views || 0
    };
  }

  // ===============================================
  // HELPER METHODS
  // ===============================================

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100) + '-' + Date.now().toString(36);
  }

  async getCategories(siteId?: number): Promise<string[]> {
    const conditions = siteId ? 'WHERE site_id = ? AND category IS NOT NULL' : 'WHERE category IS NOT NULL';
    const values = siteId ? [siteId] : [];
    
    const stmt = this.db.prepare(`SELECT DISTINCT category FROM blog_submissions ${conditions} ORDER BY category`);
    const results = await stmt.bind(...values).all<{ category: string }>();
    return results.results.map(r => r.category);
  }
}

export default BlogService;
