import type { DocRow, DocSummary, SiteSettings } from "../types";
import { browserTitle, escapeHtml, faviconHref, formatDate } from "../utils";
import { adminLayout, brandMark } from "./layout";

export interface DocFormValues {
  id?: number;
  slug: string;
  title: string;
  summary: string;
  content: string;
  sort_order: string;
  published: boolean;
}

export interface DocFormErrors {
  title?: string;
  slug?: string;
  summary?: string;
  content?: string;
  sort_order?: string;
}

export function docToFormValues(doc: DocRow): DocFormValues {
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    content: doc.content,
    sort_order: String(doc.sort_order),
    published: doc.published === 1,
  };
}

function flash(message: string | null, kind: "success" | "error" = "success"): string {
  if (!message) return "";
  return `<div class="flash flash--${kind}" role="status">${escapeHtml(message)}</div>`;
}

export function adminDocsPage(
  settings: SiteSettings,
  docs: DocSummary[],
  message: string | null,
): string {
  const published = docs.filter((doc) => doc.published === 1).length;

  const rows = docs
    .map(
      (doc) => `<tr>
        <td class="cell-title">
          <a href="/admin/docs/${doc.id}/edit">${escapeHtml(doc.title)}</a>
          <span class="cell-sub">/docs/${escapeHtml(doc.slug)}</span>
        </td>
        <td>
          <span class="badge ${doc.published ? "badge--live" : "badge--draft"}">
            ${doc.published ? "已发布" : "草稿"}
          </span>
        </td>
        <td class="cell-muted">${doc.sort_order}</td>
        <td class="cell-muted">${formatDate(doc.updated_at)}</td>
        <td class="cell-actions">
          <a class="table-link" href="/admin/docs/${doc.id}/edit">编辑</a>
          <a class="table-link" href="/docs/${encodeURIComponent(doc.slug)}" target="_blank" rel="noopener">查看</a>
          <form method="post" action="/admin/docs/${doc.id}/delete" class="inline-form" data-confirm="确定删除《${escapeHtml(doc.title)}》？此操作无法撤销。">
            <button class="table-link table-link--danger" type="submit">删除</button>
          </form>
        </td>
      </tr>`,
    )
    .join("");

  const table =
    docs.length > 0
      ? `<div class="card table-card">
          <div class="table-wrap">
            <table class="doc-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>状态</th>
                  <th>排序</th>
                  <th>更新时间</th>
                  <th><span class="sr-only">操作</span></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`
      : `<div class="card empty-state empty-state--admin">
          <p class="eyebrow">Empty</p>
          <h2>还没有文档</h2>
          <p>新建第一篇文档，开始记录你的内容。</p>
          <a class="btn btn-primary" href="/admin/docs/new">新建文档</a>
        </div>`;

  const body = `<header class="admin-head">
    <div>
      <p class="eyebrow">Content</p>
      <h1>文档</h1>
      <p class="admin-subtitle">共 ${docs.length} 篇，其中 ${published} 篇已发布。排序值越小越靠前。</p>
    </div>
    <a class="btn btn-primary" href="/admin/docs/new">＋ 新建文档</a>
  </header>
  ${flash(message)}
  ${table}`;

  return adminLayout({ title: `文档 · ${browserTitle(settings)}`, active: "docs", settings, body });
}

function fieldError(message: string | undefined): string {
  return message ? `<p class="field-error">${escapeHtml(message)}</p>` : "";
}

function fieldClass(message: string | undefined): string {
  return message ? "field field--error" : "field";
}

export function adminEditorPage(
  settings: SiteSettings,
  values: DocFormValues,
  errors: DocFormErrors,
  mode: "create" | "edit",
): string {
  const editing = mode === "edit" && values.id !== undefined;
  const title = editing ? "编辑文档" : "新建文档";
  const action = editing ? `/admin/docs/${values.id}` : "/admin/docs";
  const deleteForm = editing
    ? `<form method="post" action="/admin/docs/${values.id}/delete" class="inline-form" data-confirm="确定删除《${escapeHtml(values.title || "这篇文档")}》？此操作无法撤销。">
        <button class="btn btn-danger-ghost" type="submit">删除</button>
      </form>`
    : "";

  const body = `<header class="admin-head admin-head--editor">
    <div>
      <nav class="breadcrumb breadcrumb--admin" aria-label="面包屑">
        <a href="/admin/docs">文档</a>
        <span aria-hidden="true">/</span>
        <span>${editing ? "编辑" : "新建"}</span>
      </nav>
      <h1>${title}</h1>
    </div>
    <div class="admin-head-actions">
      <a class="btn btn-ghost" href="/admin/docs">取消</a>
      ${deleteForm}
    </div>
  </header>

  <form method="post" action="${action}" class="editor-form" id="doc-form">
    <div class="form-grid">
      <div class="card card--pad">
        <div class="${fieldClass(errors.title)}">
          <label for="title">标题 <span class="required">*</span></label>
          <input class="input input--title" id="title" name="title" type="text" maxlength="120" required value="${escapeHtml(values.title)}" placeholder="给这篇文档起个名字">
          ${fieldError(errors.title)}
        </div>

        <div class="${fieldClass(errors.slug)}">
          <label for="slug">Slug</label>
          <div class="slug-input">
            <span class="slug-prefix">/docs/</span>
            <input class="input" id="slug" name="slug" type="text" maxlength="64" value="${escapeHtml(values.slug)}" placeholder="留空自动生成" pattern="[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?">
          </div>
          <p class="hint">用于网址，只能包含小写字母、数字和连字符。留空会自动生成。</p>
          ${fieldError(errors.slug)}
        </div>

        <div class="${fieldClass(errors.summary)}">
          <label for="summary">摘要</label>
          <textarea class="input textarea textarea--short" id="summary" name="summary" maxlength="300" rows="3" placeholder="一句话介绍这篇文档（可选）">${escapeHtml(values.summary)}</textarea>
          <p class="hint">显示在首页卡片和文档标题下方，最多 300 字。</p>
          ${fieldError(errors.summary)}
        </div>

        <div class="${fieldClass(errors.content)}">
          <label for="content">正文 <span class="required">*</span></label>
          <textarea class="input textarea textarea--editor" id="content" name="content" required spellcheck="false" placeholder="# 从这里开始写…">${escapeHtml(values.content)}</textarea>
          <p class="hint">支持 Markdown。原始 HTML 不会被渲染，避免脚本注入。</p>
          ${fieldError(errors.content)}
        </div>
      </div>

      <aside class="editor-side">
        <div class="card card--pad">
          <h2 class="card-title">发布</h2>
          <label class="switch-row">
            <input type="checkbox" name="published" value="1" ${values.published ? "checked" : ""}>
            <span>
              <strong>公开文档</strong>
              <small>关闭后保存为草稿，仅后台可见。</small>
            </span>
          </label>

          <div class="field field--compact">
            <label for="sort_order">排序</label>
            <input class="input" id="sort_order" name="sort_order" type="number" min="-9999" max="9999" step="1" value="${escapeHtml(values.sort_order)}">
            <p class="hint">数字越小越靠前。</p>
            ${fieldError(errors.sort_order)}
          </div>

          <button class="btn btn-primary btn-block" type="submit">${editing ? "保存修改" : "创建文档"}</button>
          <p class="hint hint--center">Ctrl / ⌘ + S 也可以保存</p>
        </div>

        <div class="card card--pad card--muted">
          <h2 class="card-title">写作提示</h2>
          <ul class="tip-list">
            <li><code>#</code> 一级标题，<code>##</code> 二级标题</li>
            <li><code>**粗体**</code> 与 <code>*斜体*</code></li>
            <li><code>[文字](https://…)</code> 添加链接</li>
            <li><code>\`\`\`</code> 包裹代码块</li>
          </ul>
        </div>
      </aside>
    </div>
  </form>

  <div class="mobile-savebar" role="group" aria-label="编辑操作">
    <a class="btn btn-ghost" href="/admin/docs">取消</a>
    <button class="btn btn-primary" type="submit" form="doc-form">${editing ? "保存修改" : "创建文档"}</button>
  </div>`;

  return adminLayout({
    title: `${title} · ${browserTitle(settings)}`,
    active: "docs",
    settings,
    body,
    bodyClass: "admin-body--editor",
  });
}

export function adminSettingsPage(
  settings: SiteSettings,
  values: SiteSettings,
  errors: {
    site_title?: string;
    browser_title?: string;
    site_description?: string;
    footer?: string;
    favicon?: string;
    logo?: string;
  },
  message: string | null,
): string {
  const faviconSrc = faviconHref(values);
  const faviconRemove = values.favicon_key
    ? `<label class="checkbox-inline"><input type="checkbox" name="remove_favicon" value="1"> 恢复默认图标</label>`
    : "";
  const logoRemove = values.logo_key
    ? `<label class="checkbox-inline"><input type="checkbox" name="remove_logo" value="1"> 恢复默认 Logo</label>`
    : "";

  const body = `<header class="admin-head">
    <div>
      <p class="eyebrow">Settings</p>
      <h1>站点设置</h1>
      <p class="admin-subtitle">管理站点名称、浏览器标题、图标与品牌 Logo。</p>
    </div>
    <a class="btn btn-ghost" href="/" target="_blank" rel="noopener">查看站点 ↗</a>
  </header>
  ${flash(message)}
  <form method="post" action="/admin/settings" class="settings-form" enctype="multipart/form-data">
    <div class="card card--pad settings-card">
      <div class="${fieldClass(errors.site_title)}">
        <label for="site_title">站点名称 <span class="required">*</span></label>
        <input class="input" id="site_title" name="site_title" type="text" maxlength="60" required value="${escapeHtml(values.site_title)}">
        <p class="hint">显示在侧栏、首页大标题和登录页。</p>
        ${fieldError(errors.site_title)}
      </div>

      <div class="${fieldClass(errors.browser_title)}">
        <label for="browser_title">网页标题</label>
        <input class="input" id="browser_title" name="browser_title" type="text" maxlength="120" value="${escapeHtml(values.browser_title)}" placeholder="${escapeHtml(values.site_title)}">
        <p class="hint">显示在浏览器标签页和搜索结果中；留空时使用站点名称。</p>
        ${fieldError(errors.browser_title)}
      </div>

      <div class="${fieldClass(errors.site_description)}">
        <label for="site_description">站点简介</label>
        <textarea class="input textarea textarea--short" id="site_description" name="site_description" maxlength="200" rows="3">${escapeHtml(values.site_description)}</textarea>
        <p class="hint">显示在首页大标题下方和侧边栏中，最多 200 字。</p>
        ${fieldError(errors.site_description)}
      </div>

      <div class="${fieldClass(errors.footer)}">
        <label for="footer">页脚文字</label>
        <input class="input" id="footer" name="footer" type="text" maxlength="160" value="${escapeHtml(values.footer)}">
        ${fieldError(errors.footer)}
      </div>

      <div class="settings-divider"></div>
      <h2 class="card-title settings-section-title">品牌素材</h2>
      <p class="hint settings-section-hint">上传后立即用于公开站点和后台。图片保存在 D1 中，建议保持小尺寸。</p>

      <div class="asset-grid">
        <div class="asset-field">
          <div class="asset-preview asset-preview--favicon">
            <img src="${faviconSrc}" alt="当前网页图标">
          </div>
          <div class="asset-body">
            <label for="favicon">网页图标</label>
            <p class="hint">浏览器标签页图标。PNG / ICO / WebP，最大 256KB。</p>
            <input class="file-input" id="favicon" name="favicon" type="file" accept="image/png,image/webp,image/x-icon,image/vnd.microsoft.icon">
            ${faviconRemove}
            ${fieldError(errors.favicon)}
          </div>
        </div>

        <div class="asset-field">
          <div class="asset-preview asset-preview--logo">
            ${brandMark(values, "brand-mark--large")}
          </div>
          <div class="asset-body">
            <label for="logo">网站 Logo</label>
            <p class="hint">替换侧栏和登录页的「页」字。PNG / JPEG / WebP，最大 1MB。</p>
            <input class="file-input" id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp">
            ${logoRemove}
            ${fieldError(errors.logo)}
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary" type="submit">保存设置</button>
        <a class="btn btn-ghost" href="/admin/docs">返回文档</a>
      </div>
    </div>

    <div class="card card--pad card--muted settings-preview">
      <p class="eyebrow">Preview</p>
      <div class="settings-preview-head">
        ${brandMark(values, "brand-mark--large")}
        <div>
          <h2>${escapeHtml(values.site_title)}</h2>
          <p>${escapeHtml(values.site_description)}</p>
        </div>
      </div>
      <p class="preview-meta">标签页标题：${escapeHtml(values.browser_title || values.site_title)}</p>
      <span class="settings-preview-footer">${escapeHtml(values.footer)}</span>
    </div>
  </form>`;

  return adminLayout({ title: `站点设置 · ${browserTitle(settings)}`, active: "settings", settings, body });
}

export function adminNotFoundPage(settings: SiteSettings): string {
  const body = `<div class="card empty-state empty-state--admin">
    <p class="eyebrow">404</p>
    <h2>没有找到这篇文档</h2>
    <p>它可能已经被删除，或者链接有误。</p>
    <a class="btn btn-primary" href="/admin/docs">返回文档列表</a>
  </div>`;
  return adminLayout({ title: `未找到 · ${browserTitle(settings)}`, active: "docs", settings, body });
}
