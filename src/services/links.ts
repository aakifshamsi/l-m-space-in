import type { Env, Link, Tag } from '../config';
import { createDbHelper, generateSlug, isValidUrl } from '../db';

export interface CreateLinkInput {
  url: string;
  slug?: string;
  custom_alias?: string;
  title?: string;
  description?: string;
  redirect_type?: '301' | '302';
  expires_at?: string;
  max_clicks?: number;
  ad_free?: number;
  tags?: number[];
}

export interface UpdateLinkInput {
  url?: string;
  slug?: string;
  custom_alias?: string;
  title?: string;
  description?: string;
  redirect_type?: '301' | '302';
  expires_at?: string | null;
  max_clicks?: number | null;
  ad_free?: number;
  is_active?: number;
  tags?: number[];
}

export interface LinkWithTags extends Link {
  tags: Tag[];
  total_clicks?: number;
  last_clicked?: string;
}

export interface LinkFilters {
  search?: string;
  is_active?: number;
  created_by?: number;
  tag_id?: number;
  page?: number;
  limit?: number;
}

export function createLinksService(env: Env['DB']) {
  const db = createDbHelper(env);

  // Generate unique slug
  async function generateUniqueSlug(length: number = 8): Promise<string> {
    let slug = generateSlug(length);
    let exists = await db.get<Link>('SELECT id FROM links WHERE slug = ?', [slug]);
    
    while (exists) {
      slug = generateSlug(length);
      exists = await db.get<Link>('SELECT id FROM links WHERE slug = ?', [slug]);
    }
    
    return slug;
  }

  // Create a new link
  async function create(input: CreateLinkInput, userId: number): Promise<Link> {
    if (!isValidUrl(input.url)) {
      throw new Error('Invalid URL');
    }

    // Generate slug if not provided
    const slug = input.slug || await generateUniqueSlug();

    // Check for slug/alias conflicts
    if (input.slug) {
      const existing = await db.get<Link>(
        'SELECT id FROM links WHERE slug = ? OR custom_alias = ?',
        [input.slug, input.slug]
      );
      if (existing) {
        throw new Error('Slug already exists');
      }
    }

    if (input.custom_alias) {
      const existing = await db.get<Link>(
        'SELECT id FROM links WHERE slug = ? OR custom_alias = ?',
        [input.custom_alias, input.custom_alias]
      );
      if (existing) {
        throw new Error('Custom alias already exists');
      }
    }

    // Default ad_free based on user role (admins get ad-free by default)
    const adFreeDefault = input.ad_free !== undefined ? input.ad_free : 0;

    const result = await db.run(
      `INSERT INTO links (slug, custom_alias, url, title, description, redirect_type, expires_at, max_clicks, ad_free, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        input.custom_alias || null,
        input.url,
        input.title || null,
        input.description || null,
        input.redirect_type || '302',
        input.expires_at || null,
        input.max_clicks || null,
        adFreeDefault,
        userId,
      ]
    );

    const link = await db.get<Link>('SELECT * FROM links WHERE id = ?', [result.lastInsertRowid]);
    if (!link) throw new Error('Failed to create link');

    // Add tags if provided
    if (input.tags && input.tags.length > 0) {
      for (const tagId of input.tags) {
        await db.run('INSERT INTO link_tags (link_id, tag_id) VALUES (?, ?)', [link.id, tagId]);
      }
    }

    return link;
  }

  // Get link by ID
  async function getById(id: number): Promise<LinkWithTags | null> {
    const link = await db.get<Link>('SELECT * FROM links WHERE id = ?', [id]);
    if (!link) return null;

    const tags = await db.all<Tag>(
      'SELECT t.* FROM tags t JOIN link_tags lt ON t.id = lt.tag_id WHERE lt.link_id = ?',
      [id]
    );

    return { ...link, tags };
  }

  // Get link by slug
  async function getBySlug(slug: string): Promise<LinkWithTags | null> {
    const link = await db.get<Link>(
      'SELECT * FROM links WHERE slug = ? OR custom_alias = ?',
      [slug, slug]
    );
    if (!link) return null;

    const tags = await db.all<Tag>(
      'SELECT t.* FROM tags t JOIN link_tags lt ON t.id = lt.tag_id WHERE lt.link_id = ?',
      [link.id]
    );

    return { ...link, tags };
  }

  // Update link
  async function update(id: number, input: UpdateLinkInput): Promise<Link> {
    const existing = await db.get<Link>('SELECT * FROM links WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('Link not found');
    }

    if (input.url && !isValidUrl(input.url)) {
      throw new Error('Invalid URL');
    }

    // Check for slug/alias conflicts (excluding current link)
    if (input.slug && input.slug !== existing.slug) {
      const existingSlug = await db.get<Link>(
        'SELECT id FROM links WHERE (slug = ? OR custom_alias = ?) AND id != ?',
        [input.slug, input.slug, id]
      );
      if (existingSlug) {
        throw new Error('Slug already exists');
      }
    }

    if (input.custom_alias && input.custom_alias !== existing.custom_alias) {
      const existingAlias = await db.get<Link>(
        'SELECT id FROM links WHERE (slug = ? OR custom_alias = ?) AND id != ?',
        [input.custom_alias, input.custom_alias, id]
      );
      if (existingAlias) {
        throw new Error('Custom alias already exists');
      }
    }

    await db.run(
      `UPDATE links SET 
        slug = COALESCE(?, slug),
        custom_alias = COALESCE(?, custom_alias),
        url = COALESCE(?, url),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        redirect_type = COALESCE(?, redirect_type),
        expires_at = ?,
        max_clicks = ?,
        ad_free = COALESCE(?, ad_free),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        input.slug || null,
        input.custom_alias !== undefined ? input.custom_alias : null,
        input.url || null,
        input.title !== undefined ? input.title : null,
        input.description !== undefined ? input.description : null,
        input.redirect_type || null,
        input.expires_at !== undefined ? input.expires_at : existing.expires_at,
        input.max_clicks !== undefined ? input.max_clicks : existing.max_clicks,
        input.ad_free !== undefined ? input.ad_free : null,
        input.is_active !== undefined ? input.is_active : null,
        id,
      ]
    );

    // Update tags if provided
    if (input.tags !== undefined) {
      await db.run('DELETE FROM link_tags WHERE link_id = ?', [id]);
      for (const tagId of input.tags) {
        await db.run('INSERT INTO link_tags (link_id, tag_id) VALUES (?, ?)', [id, tagId]);
      }
    }

    const updated = await db.get<Link>('SELECT * FROM links WHERE id = ?', [id]);
    if (!updated) throw new Error('Failed to update link');

    return updated;
  }

  // Soft delete (deactivate) link
  async function deactivate(id: number): Promise<void> {
    await db.run('UPDATE links SET is_active = 0 WHERE id = ?', [id]);
  }

  // Reactivate link
  async function reactivate(id: number): Promise<void> {
    await db.run('UPDATE links SET is_active = 1 WHERE id = ?', [id]);
  }

  // Delete link permanently
  async function removeLink(id: number): Promise<void> {
    await db.run('DELETE FROM link_tags WHERE link_id = ?', [id]);
    await db.run('DELETE FROM links WHERE id = ?', [id]);
  }

  // List links with filters
  async function list(filters: LinkFilters = {}): Promise<{ links: LinkWithTags[]; total: number }> {
    const { search, is_active, created_by, tag_id, page = 1, limit = 20 } = filters;
    
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push('(l.url LIKE ? OR l.title LIKE ? OR l.description LIKE ? OR l.slug LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (is_active !== undefined) {
      conditions.push('l.is_active = ?');
      params.push(is_active);
    }

    if (created_by) {
      conditions.push('l.created_by = ?');
      params.push(created_by);
    }

    if (tag_id) {
      conditions.push('l.id IN (SELECT link_id FROM link_tags WHERE tag_id = ?)');
      params.push(tag_id);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Get total count
    const countResult = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM links l ${whereClause}`,
      params
    );
    const total = countResult?.count || 0;

    // Get links with pagination
    const offset = (page - 1) * limit;
    const links = await db.all<Link>(
      `SELECT * FROM links l ${whereClause} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get tags and clicks for each link
    const linksWithTags: LinkWithTags[] = await Promise.all(
      links.map(async (link) => {
        const tags = await db.all<Tag>(
          'SELECT t.* FROM tags t JOIN link_tags lt ON t.id = lt.tag_id WHERE lt.link_id = ?',
          [link.id]
        );
        return { ...link, tags };
      })
    );

    return { links: linksWithTags, total };
  }

  // Get all tags
  async function getTags(): Promise<Tag[]> {
    return db.all<Tag>('SELECT * FROM tags ORDER BY name');
  }

  // Create tag
  async function createTag(name: string, color: string): Promise<Tag> {
    const result = await db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color]);
    const tag = await db.get<Tag>('SELECT * FROM tags WHERE id = ?', [result.lastInsertRowid]);
    if (!tag) throw new Error('Failed to create tag');
    return tag;
  }

  // Delete tag
  async function removeTag(id: number): Promise<void> {
    await db.run('DELETE FROM link_tags WHERE tag_id = ?', [id]);
    await db.run('DELETE FROM tags WHERE id = ?', [id]);
  }

  return {
    create,
    getById,
    getBySlug,
    update,
    deactivate,
    reactivate,
    delete: removeLink,
    list,
    getTags,
    createTag,
    deleteTag: removeTag,
  };
}

export type LinksService = ReturnType<typeof createLinksService>;