import {
  DEFAULT_SETTINGS,
  type DocInput,
  type DocRow,
  type DocSummary,
  type SiteSettings,
} from "./types";

const SUMMARY_COLUMNS =
  "id, slug, title, summary, sort_order, published, created_at, updated_at";

export async function listPublishedDocs(db: D1Database): Promise<DocSummary[]> {
  const result = await db
    .prepare(
      `SELECT ${SUMMARY_COLUMNS}
       FROM docs
       WHERE published = 1
       ORDER BY sort_order ASC, id ASC`,
    )
    .all<DocSummary>();
  return result.results;
}

export async function listAllDocs(db: D1Database): Promise<DocSummary[]> {
  const result = await db
    .prepare(
      `SELECT ${SUMMARY_COLUMNS}
       FROM docs
       ORDER BY sort_order ASC, id ASC`,
    )
    .all<DocSummary>();
  return result.results;
}

export async function getPublishedDoc(
  db: D1Database,
  slug: string,
): Promise<DocRow | null> {
  return db
    .prepare("SELECT * FROM docs WHERE slug = ? AND published = 1")
    .bind(slug)
    .first<DocRow>();
}

export async function getDocById(db: D1Database, id: number): Promise<DocRow | null> {
  return db.prepare("SELECT * FROM docs WHERE id = ?").bind(id).first<DocRow>();
}

export async function slugExists(
  db: D1Database,
  slug: string,
  excludeId: number | null = null,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM docs WHERE slug = ? AND id != ?")
    .bind(slug, excludeId ?? -1)
    .first<{ id: number }>();
  return row !== null;
}

export async function createDoc(db: D1Database, input: DocInput): Promise<number> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO docs
         (slug, title, summary, content, sort_order, published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.slug,
      input.title,
      input.summary,
      input.content,
      input.sort_order,
      input.published ? 1 : 0,
      now,
      now,
    )
    .run();
  return result.meta.last_row_id ?? 0;
}

export async function updateDoc(
  db: D1Database,
  id: number,
  input: DocInput,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE docs
       SET slug = ?, title = ?, summary = ?, content = ?,
           sort_order = ?, published = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.slug,
      input.title,
      input.summary,
      input.content,
      input.sort_order,
      input.published ? 1 : 0,
      new Date().toISOString(),
      id,
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteDoc(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare("DELETE FROM docs WHERE id = ?").bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function getSettings(db: D1Database): Promise<SiteSettings> {
  const result = await db
    .prepare("SELECT key, value FROM settings")
    .all<{ key: string; value: string }>();

  const values = new Map(result.results.map((row) => [row.key, row.value]));
  const setting = (key: string, fallback: string): string => {
    if (!values.has(key)) return fallback;
    return (values.get(key) ?? "").trim();
  };

  return {
    site_title: setting("site_title", DEFAULT_SETTINGS.site_title) || DEFAULT_SETTINGS.site_title,
    browser_title: setting("browser_title", DEFAULT_SETTINGS.browser_title),
    site_description: setting("site_description", DEFAULT_SETTINGS.site_description),
    footer: setting("footer", DEFAULT_SETTINGS.footer),
    favicon_key: setting("favicon_key", ""),
    logo_key: setting("logo_key", ""),
  };
}

export async function saveSettings(
  db: D1Database,
  settings: SiteSettings,
): Promise<void> {
  const statement = db.prepare(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );

  await db.batch([
    statement.bind("site_title", settings.site_title),
    statement.bind("browser_title", settings.browser_title),
    statement.bind("site_description", settings.site_description),
    statement.bind("footer", settings.footer),
    statement.bind("favicon_key", settings.favicon_key),
    statement.bind("logo_key", settings.logo_key),
  ]);
}

export interface StoredAsset {
  key: string;
  mime: string;
  size: number;
  data: ArrayBuffer | number[];
}

export async function createAsset(
  db: D1Database,
  key: string,
  mime: string,
  data: Uint8Array,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO assets (key, mime, size, data, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(key, mime, data.byteLength, data, new Date().toISOString())
    .run();
}

export async function getAsset(
  db: D1Database,
  key: string,
): Promise<StoredAsset | null> {
  return db
    .prepare("SELECT key, mime, size, data FROM assets WHERE key = ?")
    .bind(key)
    .first<StoredAsset>();
}

export async function deleteAsset(db: D1Database, key: string): Promise<void> {
  if (!key) return;
  await db.prepare("DELETE FROM assets WHERE key = ?").bind(key).run();
}
