export interface Env {
  DB: D1Database;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
}

export interface DocRow {
  id: number;
  slug: string;
  title: string;
  summary: string;
  content: string;
  sort_order: number;
  published: number;
  created_at: string;
  updated_at: string;
}

export type DocSummary = Omit<DocRow, "content">;

export interface SiteSettings {
  site_title: string;
  browser_title: string;
  site_description: string;
  footer: string;
  favicon_key: string;
  logo_key: string;
}

export interface DocInput {
  slug: string;
  title: string;
  summary: string;
  content: string;
  sort_order: number;
  published: boolean;
}

export interface AppVariables {
  settings: SiteSettings;
  isAdmin: boolean;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  site_title: "页间",
  browser_title: "页间 · 个人文档",
  site_description: "把零散的想法，整理成一页一页的文档。",
  footer: "© 2026 页间 · 用文字记录日常",
  favicon_key: "",
  logo_key: "",
};
