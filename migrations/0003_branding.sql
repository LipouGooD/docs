CREATE TABLE IF NOT EXISTS assets (
  key TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('browser_title', '页间 · 个人文档'),
  ('favicon_key', ''),
  ('logo_key', '')
ON CONFLICT(key) DO NOTHING;
