import type { DocRow, DocSummary, SiteSettings } from "../types";
import { browserTitle, escapeHtml, formatDate } from "../utils";
import { publicLayout } from "./layout";

function documentCards(docs: DocSummary[]): string {
  if (docs.length === 0) {
    return `<div class="empty-state empty-state--inline">
      <p class="eyebrow">Empty</p>
      <h2>还没有公开文档</h2>
      <p>去管理后台新建一篇，它会立刻出现在这里。</p>
      <a class="btn btn-primary" href="/admin/docs/new">新建文档</a>
    </div>`;
  }

  return `<section class="doc-grid" aria-label="文档列表">
    ${docs
      .map(
        (doc, index) => `<a class="doc-card" href="/docs/${encodeURIComponent(doc.slug)}">
          <span class="doc-index">${String(index + 1).padStart(2, "0")}</span>
          <h2>${escapeHtml(doc.title)}</h2>
          ${doc.summary ? `<p>${escapeHtml(doc.summary)}</p>` : ""}
          <span class="doc-card-meta">更新于 ${formatDate(doc.updated_at)}</span>
        </a>`,
      )
      .join("")}
  </section>`;
}

export function homePage(
  settings: SiteSettings,
  docs: DocSummary[],
  isAdmin: boolean,
): string {
  const body = `<header class="page-head">
    <p class="eyebrow">Personal docs</p>
    <h1 class="page-title">${escapeHtml(settings.site_title)}</h1>
    <p class="lead">${escapeHtml(settings.site_description)}</p>
    <div class="page-meta">
      <span>${docs.length} 篇文档</span>
      <span class="dot" aria-hidden="true"></span>
      <span>持续更新中</span>
      ${isAdmin ? `<a class="text-link" href="/admin/docs">进入后台 →</a>` : ""}
    </div>
  </header>
  ${documentCards(docs)}`;

  return publicLayout({
    title: browserTitle(settings),
    description: settings.site_description,
    settings,
    docs,
    isAdmin,
    body,
  });
}

export function docPage(
  settings: SiteSettings,
  docs: DocSummary[],
  doc: DocRow,
  html: string,
  isAdmin: boolean,
): string {
  const index = docs.findIndex((item) => item.slug === doc.slug);
  const previous = index > 0 ? docs[index - 1] : undefined;
  const next = index >= 0 && index < docs.length - 1 ? docs[index + 1] : undefined;

  const pager = `<nav class="pager" aria-label="文档翻页">
    ${
      previous
        ? `<a class="pager-link" href="/docs/${encodeURIComponent(previous.slug)}">
            <span class="pager-label">← 上一篇</span>
            <span class="pager-title">${escapeHtml(previous.title)}</span>
          </a>`
        : `<span></span>`
    }
    ${
      next
        ? `<a class="pager-link pager-link--next" href="/docs/${encodeURIComponent(next.slug)}">
            <span class="pager-label">下一篇 →</span>
            <span class="pager-title">${escapeHtml(next.title)}</span>
          </a>`
        : `<span></span>`
    }
  </nav>`;

  const body = `<nav class="breadcrumb" aria-label="面包屑">
    <a href="/">文档</a>
    <span aria-hidden="true">/</span>
    <span>${escapeHtml(doc.title)}</span>
  </nav>
  <div class="doc-sheet">
    <header class="doc-head">
      <p class="eyebrow">文档</p>
      <h1>${escapeHtml(doc.title)}</h1>
      ${doc.summary ? `<p class="lead">${escapeHtml(doc.summary)}</p>` : ""}
      <div class="doc-meta">
        <span>更新于 ${formatDate(doc.updated_at)}</span>
        ${
          isAdmin
            ? `<a class="text-link" href="/admin/docs/${doc.id}/edit">编辑此页 →</a>`
            : ""
        }
      </div>
    </header>
    <article class="prose">${html}</article>
    ${pager}
  </div>`;

  return publicLayout({
    title: `${doc.title} · ${browserTitle(settings)}`,
    description: doc.summary || settings.site_description,
    settings,
    docs,
    activeSlug: doc.slug,
    isAdmin,
    body,
  });
}

export function notFoundPage(
  settings: SiteSettings,
  docs: DocSummary[],
  isAdmin: boolean,
): string {
  const body = `<div class="empty-state">
    <p class="eyebrow">404</p>
    <h1>这一页还没有写。</h1>
    <p>链接可能已经失效，或者这篇文档还没有发布。</p>
    <a class="btn btn-primary" href="/">回到首页</a>
  </div>`;

  return publicLayout({
    title: `页面不存在 · ${browserTitle(settings)}`,
    description: "页面不存在",
    settings,
    docs,
    isAdmin,
    body,
  });
}
