import type { Env, Handle } from '../config';
import { createDbHelper, isValidUrl } from '../db';

export interface CreateHandleInput {
  platform: Handle['platform'];
  handle: string;
  url: string;
  display_name?: string;
  is_enabled?: number;
  is_primary?: number;
}

export interface UpdateHandleInput {
  platform?: Handle['platform'];
  handle?: string;
  url?: string;
  display_name?: string | null;
  is_enabled?: number;
  is_primary?: number;
}

export function createHandlesService(env: Env['DB']) {
  const db = createDbHelper(env);

  // Create a new handle
  async function create(input: CreateHandleInput): Promise<Handle> {
    if (!isValidUrl(input.url)) {
      throw new Error('Invalid URL');
    }

    const result = await db.run(
      `INSERT INTO handles (platform, handle, url, display_name, is_enabled, is_primary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.platform,
        input.handle,
        input.url,
        input.display_name || null,
        input.is_enabled || 0,
        input.is_primary || 0,
      ]
    );

    const handle = await db.get<Handle>('SELECT * FROM handles WHERE id = ?', [result.lastInsertRowid]);
    if (!handle) throw new Error('Failed to create handle');
    return handle;
  }

  // Get handle by ID
  async function getById(id: number): Promise<Handle | null> {
    return db.get<Handle>('SELECT * FROM handles WHERE id = ?', [id]);
  }

  // Get all handles
  async function getAll(): Promise<Handle[]> {
    return db.all<Handle>('SELECT * FROM handles ORDER BY platform, handle');
  }

  // Get enabled handles
  async function getEnabled(): Promise<Handle[]> {
    return db.all<Handle>('SELECT * FROM handles WHERE is_enabled = 1 ORDER BY is_primary DESC, platform, handle');
  }

  // Get primary handle by platform
  async function getByPlatform(platform: string): Promise<Handle | null> {
    return db.get<Handle>(
      'SELECT * FROM handles WHERE platform = ? AND is_enabled = 1 ORDER BY is_primary DESC LIMIT 1',
      [platform]
    );
  }

  // Update handle
  async function update(id: number, input: UpdateHandleInput): Promise<Handle> {
    const existing = await db.get<Handle>('SELECT * FROM handles WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('Handle not found');
    }

    if (input.url && !isValidUrl(input.url)) {
      throw new Error('Invalid URL');
    }

    await db.run(
      `UPDATE handles SET 
        platform = COALESCE(?, platform),
        handle = COALESCE(?, handle),
        url = COALESCE(?, url),
        display_name = ?,
        is_enabled = COALESCE(?, is_enabled),
        is_primary = COALESCE(?, is_primary),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        input.platform || null,
        input.handle || null,
        input.url || null,
        input.display_name !== undefined ? input.display_name : existing.display_name,
        input.is_enabled !== undefined ? input.is_enabled : null,
        input.is_primary !== undefined ? input.is_primary : null,
        id,
      ]
    );

    const updated = await db.get<Handle>('SELECT * FROM handles WHERE id = ?', [id]);
    if (!updated) throw new Error('Failed to update handle');
    return updated;
  }

  // Enable/disable handle
  async function setEnabled(id: number, isEnabled: boolean): Promise<void> {
    await db.run('UPDATE handles SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [isEnabled ? 1 : 0, id]);
  }

  // Set as primary
  async function setPrimary(id: number): Promise<void> {
    const handle = await db.get<Handle>('SELECT * FROM handles WHERE id = ?', [id]);
    if (!handle) {
      throw new Error('Handle not found');
    }

    // Unset other handles of same platform as primary
    await db.run('UPDATE handles SET is_primary = 0 WHERE platform = ?', [handle.platform]);
    // Set this handle as primary
    await db.run('UPDATE handles SET is_primary = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }

  // Delete handle
  async function remove(id: number): Promise<void> {
    await db.run('DELETE FROM handles WHERE id = ?', [id]);
  }

  return {
    create,
    getById,
    getAll,
    getEnabled,
    getByPlatform,
    update,
    setEnabled,
    setPrimary,
    delete: remove,
  };
}

export type HandlesService = ReturnType<typeof createHandlesService>;