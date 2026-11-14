import type { SiteSettings } from "./types";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/**
 * Format an ISO timestamp as a compact Chinese date without depending on
 * locale data being present in the Workers runtime.
 */
export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  if (!year || !month || !day) return value;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value);
}

export function newDocSlug(): string {
  return `doc-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export function browserTitle(settings: SiteSettings): string {
  return settings.browser_title || settings.site_title;
}

export function faviconHref(settings: SiteSettings): string {
  return settings.favicon_key ? `/media/${encodeURIComponent(settings.favicon_key)}` : "/favicon.svg";
}
