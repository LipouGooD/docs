import { browserTitle, escapeHtml, faviconHref } from "../utils";
import type { DocSummary, SiteSettings } from "../types";

interface PublicLayoutOptions {
  title: string;
  description: string;
  settings: SiteSettings;
  docs: DocSummary[];
  activeSlug?: string;
  isAdmin: boolean;
  body: string;
}

const themeScript = `<script src="/theme.js"></script>`;

function themeButton(): string {
  return `<button class="icon-btn" type="button" data-theme-toggle aria-label="切换深色/浅色主题" title="切换主题">
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>
    </svg>
  </button>`;
}

function menuButton(): string {
  return `<button class="menu-button" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-sidebar" aria-label="打开目录">
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M4 7h16M4 12h16M4 17h16"/>
    </svg>
    <span>目录</span>
  </button>`;
}

function drawerCloseButton(): string {
  return `<button class="icon-btn drawer-close" type="button" data-nav-close aria-label="关闭目录">
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="m6 6 12 12M18 6 6 18"/>
    </svg>
  </button>`;
}

export function brandMark(settings: SiteSettings, extraClass = ""): string {
  const classes = ["brand-mark", extraClass, settings.logo_key ? "brand-mark--logo" : ""]
    .filter(Boolean)
    .join(" ");
  const content = settings.logo_key
    ? `<img src="/media/${encodeURIComponent(settings.logo_key)}" alt="" decoding="async">`
    : "页";

  return `<span class="${classes}" aria-hidden="true">${content}</span>`;
}

function brand(settings: SiteSettings, href: string, compact = false): string {
  return `<a class="brand${compact ? " brand--compact" : ""}" href="${href}">
    ${brandMark(settings)}
    <span class="brand-copy">
      <span class="brand-name">${escapeHtml(settings.site_title)}</span>
      <span class="brand-sub">Personal docs</span>
    </span>
  </a>`;
}

function sidebar(options: PublicLayoutOptions): string {
  const links = options.docs
    .map((doc) => {
      const active = doc.slug === options.activeSlug;
      return `<a class="nav-link${active ? " is-active" : ""}" href="/docs/${encodeURIComponent(doc.slug)}"${active ? ' aria-current="page"' : ""}>${escapeHtml(doc.title)}</a>`;
    })
    .join("");

  return `<aside class="sidebar" id="site-sidebar" aria-label="站点导航">
    <div class="sidebar-head">
      ${brand(options.settings, "/")}
      <div class="sidebar-head-actions">
        ${themeButton()}
        ${drawerCloseButton()}
      </div>
    </div>
    <p class="site-description">${escapeHtml(options.settings.site_description)}</p>
    <nav class="site-nav" aria-label="文档目录">
      <p class="nav-label">文档</p>
      ${links || `<p class="nav-empty">还没有公开文档</p>`}
    </nav>
    <div class="sidebar-foot">
      <a href="/admin">${options.isAdmin ? "管理后台" : "管理"}</a>
      <span class="dot" aria-hidden="true"></span>
      <span>Powered by Workers</span>
    </div>
  </aside>`;
}

function head(title: string, description: string, settings?: SiteSettings): string {
  const icon = settings ? faviconHref(settings) : "/favicon.svg";
  return `<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="color-scheme" content="light dark">
    <link rel="icon" href="${icon}">
    <link rel="apple-touch-icon" href="${icon}">
    ${themeScript}
    <link rel="stylesheet" href="/styles.css">
  </head>`;
}

export function publicLayout(options: PublicLayoutOptions): string {
  return `<!doctype html>
<html lang="zh-CN">
${head(options.title, options.description, options.settings)}
<body>
  <header class="mobile-header">
    ${brand(options.settings, "/", true)}
    <div class="mobile-header-actions">
      ${themeButton()}
      ${menuButton()}
    </div>
  </header>
  <div class="nav-backdrop" data-nav-close aria-hidden="true"></div>
  <div class="layout">
    ${sidebar(options)}
    <main class="main">
      <div class="main-inner">
        ${options.body}
        <footer class="site-footer">
          <span>${escapeHtml(options.settings.footer)}</span>
          <span class="site-footer-links">
            <a href="/admin">${options.isAdmin ? "管理后台" : "管理"}</a>
          </span>
        </footer>
      </div>
    </main>
  </div>
  <script src="/app.js" defer></script>
</body>
</html>`;
}

interface AdminLayoutOptions {
  title: string;
  active: "docs" | "settings";
  settings: SiteSettings;
  body: string;
  bodyClass?: string;
}

export function adminLayout(options: AdminLayoutOptions): string {
  const docsActive = options.active === "docs" ? "is-active" : "";
  const settingsActive = options.active === "settings" ? "is-active" : "";
  const docsCurrent = options.active === "docs" ? ' aria-current="page"' : "";
  const settingsCurrent = options.active === "settings" ? ' aria-current="page"' : "";
  const bodyClass = options.bodyClass ? ` ${options.bodyClass}` : "";

  return `<!doctype html>
<html lang="zh-CN">
${head(options.title, "管理后台", options.settings)}
<body class="admin-body${bodyClass}">
  <header class="admin-topbar">
    <div class="admin-brand">
      ${brand(options.settings, "/admin/docs", true)}
      <span class="admin-tag">管理</span>
    </div>
    <nav class="admin-nav" aria-label="后台导航">
      <a class="${docsActive}" href="/admin/docs"${docsCurrent}>文档</a>
      <a class="${settingsActive}" href="/admin/settings"${settingsCurrent}>站点设置</a>
      <a href="/" target="_blank" rel="noopener">查看站点 <span aria-hidden="true">↗</span></a>
    </nav>
    <div class="admin-actions">
      ${themeButton()}
      <form method="post" action="/admin/logout">
        <button class="link-button" type="submit">退出</button>
      </form>
    </div>
  </header>
  <main class="admin-wrap">
    ${options.body}
  </main>
  <script src="/app.js" defer></script>
</body>
</html>`;
}

interface LoginLayoutOptions {
  settings: SiteSettings;
  configured: boolean;
  error?: string;
  next?: string;
}

export function loginLayout(options: LoginLayoutOptions): string {
  const next = options.next ? `<input type="hidden" name="next" value="${escapeHtml(options.next)}">` : "";

  const content = options.configured
    ? `<form class="login-form" method="post" action="/admin/login">
        ${next}
        ${options.error ? `<p class="form-error" role="alert">${escapeHtml(options.error)}</p>` : ""}
        <div class="field">
          <label for="password">管理员密码</label>
          <input class="input" id="password" name="password" type="password" required autofocus autocomplete="current-password" placeholder="输入 ADMIN_PASSWORD">
        </div>
        <button class="btn btn-primary btn-block" type="submit">登录</button>
      </form>`
    : `<div class="setup-notice">
        <strong>还没有配置管理员密码</strong>
        <p>本地开发：在项目根目录的 <code>.dev.vars</code> 中设置 <code>ADMIN_PASSWORD</code>，然后重启 <code>npm run dev</code>。</p>
        <p>线上环境：运行 <code>npx wrangler secret put ADMIN_PASSWORD</code>，然后重新部署。</p>
      </div>`;

  return `<!doctype html>
<html lang="zh-CN">
${head(`管理员登录 · ${browserTitle(options.settings)}`, "管理员登录", options.settings)}
<body class="login-page">
  <main class="login-card">
    <div class="login-heading">
      ${brandMark(options.settings, "brand-mark--large")}
      <div>
        <p class="eyebrow">Admin</p>
        <h1>${escapeHtml(options.settings.site_title)}</h1>
      </div>
    </div>
    <p class="login-intro">登录后可以新建、编辑和发布文档。</p>
    ${content}
    <a class="login-back" href="/">← 返回站点</a>
  </main>
  <script src="/app.js" defer></script>
</body>
</html>`;
}

export function errorLayout(title: string, message: string): string {
  return `<!doctype html>
<html lang="zh-CN">
${head(title, "出错了")}
<body class="login-page">
  <main class="login-card error-card">
    <span class="brand-mark brand-mark--large" aria-hidden="true">页</span>
    <p class="eyebrow">Error</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="login-intro">${escapeHtml(message)}</p>
    <a class="btn btn-primary" href="/">回到首页</a>
  </main>
</body>
</html>`;
}
