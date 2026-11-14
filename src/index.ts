import { Hono, type Context, type Next } from "hono";
import {
  clearSessionCookie,
  createSessionCookie,
  isAdminConfigured,
  isAdminRequest,
  isSameOrigin,
  verifyAdminPassword,
} from "./auth";
import {
  createAsset,
  createDoc,
  deleteAsset,
  deleteDoc,
  getAsset,
  getDocById,
  getPublishedDoc,
  getSettings,
  listAllDocs,
  listPublishedDocs,
  saveSettings,
  slugExists,
  updateDoc,
} from "./db";
import { renderMarkdown } from "./markdown";
import type { AppVariables, DocInput, Env, SiteSettings } from "./types";
import { isValidSlug, newDocSlug, normalizeSlug } from "./utils";
import {
  adminDocsPage,
  adminEditorPage,
  adminNotFoundPage,
  adminSettingsPage,
  docToFormValues,
  type DocFormErrors,
  type DocFormValues,
} from "./views/admin";
import { errorLayout, loginLayout } from "./views/layout";
import { docPage, homePage, notFoundPage } from "./views/public";

type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;
type FormBody = Record<string, string | File>;
type UploadKind = "favicon" | "logo";

const FAVICON_TYPES = new Set([
  "image/png",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/ico",
]);
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_FAVICON_BYTES = 256 * 1024;
const MAX_LOGO_BYTES = 1024 * 1024;
const MEDIA_KEY_PATTERN = /^(?:favicon|logo)-[0-9a-f]{32}$/;

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "style-src 'self'",
  "script-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

app.use("*", async (c, next) => {
  try {
    await next();
  } finally {
    const path = new URL(c.req.url).pathname;
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    );
    c.header("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    if (!path.startsWith("/media/")) {
      c.header("Cache-Control", "no-store");
    }
    if (new URL(c.req.url).protocol === "https:") {
      c.header("Strict-Transport-Security", "max-age=31536000");
    }
  }
});

app.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  const isAdminPath = path === "/admin" || path.startsWith("/admin/");
  const isStateChanging = c.req.method !== "GET" && c.req.method !== "HEAD";

  if (isAdminPath && isStateChanging && !isSameOrigin(c.req.raw)) {
    return c.text("Cross-site request blocked.", 403);
  }
  await next();
});

app.use("*", async (c, next) => {
  c.set("settings", await getSettings(c.env.DB));
  c.set("isAdmin", await isAdminRequest(c.req.raw, c.env));
  await next();
});

async function requireAdmin(c: AppContext, next: Next): Promise<Response | void> {
  const path = new URL(c.req.url).pathname;
  if (path === "/admin/login" || path === "/admin/login/") {
    await next();
    return;
  }

  if (c.get("isAdmin")) {
    await next();
    return;
  }

  const url = new URL(c.req.url);
  const nextPath = `${url.pathname}${url.search}`;
  return c.redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`, 302);
}

app.use("/admin", requireAdmin);
app.use("/admin/*", requireAdmin);

function formValue(body: FormBody, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function safeAdminNext(value: string): string {
  if (!value.startsWith("/admin") || value.startsWith("//") || value.includes("\\")) {
    return "/admin/docs";
  }
  if (value === "/admin/login" || value.startsWith("/admin/login?")) {
    return "/admin/docs";
  }
  return value;
}

function readDocForm(body: FormBody): DocFormValues {
  const rawSlug = normalizeSlug(formValue(body, "slug"));
  return {
    slug: rawSlug || newDocSlug(),
    title: formValue(body, "title").trim(),
    summary: formValue(body, "summary").trim(),
    content: formValue(body, "content"),
    sort_order: formValue(body, "sort_order").trim() || "0",
    published: formValue(body, "published") === "1",
  };
}

function validateDoc(values: DocFormValues): {
  errors: DocFormErrors;
  input: DocInput | null;
} {
  const errors: DocFormErrors = {};

  if (!values.title) errors.title = "请填写标题。";
  else if (values.title.length > 120) errors.title = "标题最多 120 个字符。";

  if (!isValidSlug(values.slug)) {
    errors.slug = "Slug 只能包含小写字母、数字和连字符，且不能以连字符开头或结尾。";
  }

  if (values.summary.length > 300) errors.summary = "摘要最多 300 个字符。";
  if (!values.content.trim()) errors.content = "正文不能为空。";
  else if (values.content.length > 200_000) errors.content = "正文不能超过 20 万个字符。";

  const parsedSort = /^-?\d+$/.test(values.sort_order)
    ? Number.parseInt(values.sort_order, 10)
    : Number.NaN;
  if (!Number.isFinite(parsedSort)) {
    errors.sort_order = "排序需要是一个整数。";
  } else if (parsedSort < -9999 || parsedSort > 9999) {
    errors.sort_order = "排序需要在 -9999 到 9999 之间。";
  }

  if (Object.keys(errors).length > 0 || !Number.isFinite(parsedSort)) {
    return { errors, input: null };
  }

  return {
    errors,
    input: {
      slug: values.slug,
      title: values.title,
      summary: values.summary,
      content: values.content,
      sort_order: parsedSort,
      published: values.published,
    },
  };
}

function isUniqueSlugError(error: unknown): boolean {
  return String(error).includes("UNIQUE constraint failed: docs.slug");
}

function uploadedFile(value: string | File | undefined): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

function uploadMime(file: File): string {
  const declared = file.type.toLowerCase();
  if (declared && declared !== "application/octet-stream") return declared;

  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".ico")) return "image/x-icon";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return declared;
}

function validateUpload(
  file: File,
  kind: UploadKind,
): { mime: string } | { error: string } {
  const mime = uploadMime(file);
  const allowed = kind === "favicon" ? FAVICON_TYPES : LOGO_TYPES;
  const limit = kind === "favicon" ? MAX_FAVICON_BYTES : MAX_LOGO_BYTES;
  const label = kind === "favicon" ? "网页图标" : "网站 Logo";

  if (!allowed.has(mime)) {
    return {
      error:
        kind === "favicon"
          ? "网页图标只支持 PNG、ICO 或 WebP。"
          : "Logo 只支持 PNG、JPEG 或 WebP。",
    };
  }
  if (file.size > limit) {
    return { error: `${label}不能超过 ${Math.round(limit / 1024)}KB。` };
  }
  return { mime };
}

async function storeUpload(
  db: D1Database,
  kind: UploadKind,
  file: File,
  mime: string,
): Promise<string> {
  const key = `${kind}-${crypto.randomUUID().replace(/-/g, "")}`;
  await createAsset(db, key, mime, new Uint8Array(await file.arrayBuffer()));
  return key;
}

function flashMessage(c: AppContext): string | null {
  if (c.req.query("created") === "1") return "文档已创建。";
  if (c.req.query("updated") === "1") return "修改已保存。";
  if (c.req.query("deleted") === "1") return "文档已删除。";
  return null;
}

app.get("/", async (c) => {
  const docs = await listPublishedDocs(c.env.DB);
  return c.html(homePage(c.get("settings"), docs, c.get("isAdmin")));
});

app.get("/docs/:slug", async (c) => {
  const slug = c.req.param("slug");
  const [docs, doc] = await Promise.all([
    listPublishedDocs(c.env.DB),
    getPublishedDoc(c.env.DB, slug),
  ]);

  if (!doc) {
    return c.html(notFoundPage(c.get("settings"), docs, c.get("isAdmin")), 404);
  }

  return c.html(
    docPage(c.get("settings"), docs, doc, renderMarkdown(doc.content), c.get("isAdmin")),
  );
});

app.get("/media/:key", async (c) => {
  const key = c.req.param("key");
  if (!MEDIA_KEY_PATTERN.test(key)) return c.notFound();

  const asset = await getAsset(c.env.DB, key);
  if (!asset) return c.notFound();

  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": asset.mime,
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

app.get("/admin", (c) => c.redirect("/admin/docs", 302));

app.get("/admin/login", async (c) => {
  if (c.get("isAdmin")) return c.redirect("/admin/docs", 302);
  return c.html(
    loginLayout({
      settings: c.get("settings"),
      configured: isAdminConfigured(c.env),
      next: c.req.query("next"),
    }),
  );
});

app.post("/admin/login", async (c) => {
  const settings = c.get("settings");
  const configured = isAdminConfigured(c.env);
  const body = await c.req.parseBody();
  const password = formValue(body, "password");
  const next = safeAdminNext(formValue(body, "next"));

  if (!configured) {
    return c.html(
      loginLayout({
        settings,
        configured: false,
        error: "还没有配置管理员密码。",
        next,
      }),
      503,
    );
  }

  if (!(await verifyAdminPassword(c.env, password))) {
    return c.html(
      loginLayout({
        settings,
        configured: true,
        error: "密码不正确，请重试。",
        next,
      }),
      401,
    );
  }

  const cookie = await createSessionCookie(c.req.raw, c.env);
  if (!cookie) {
    return c.html(
      loginLayout({
        settings,
        configured: true,
        error: "会话密钥配置有误，请检查 SESSION_SECRET。",
        next,
      }),
      500,
    );
  }

  c.header("Set-Cookie", cookie);
  return c.redirect(next, 303);
});

app.post("/admin/logout", (c) => {
  c.header("Set-Cookie", clearSessionCookie(c.req.raw));
  return c.redirect("/", 303);
});

app.get("/admin/docs", async (c) => {
  const docs = await listAllDocs(c.env.DB);
  return c.html(adminDocsPage(c.get("settings"), docs, flashMessage(c)));
});

app.get("/admin/docs/new", (c) => {
  const values: DocFormValues = {
    slug: "",
    title: "",
    summary: "",
    content: "",
    sort_order: "0",
    published: true,
  };
  return c.html(adminEditorPage(c.get("settings"), values, {}, "create"));
});

app.post("/admin/docs", async (c) => {
  const body = await c.req.parseBody();
  const values = readDocForm(body);
  const { errors, input } = validateDoc(values);

  if (input) {
    if (await slugExists(c.env.DB, input.slug)) {
      errors.slug = "这个 Slug 已经被占用了，请换一个。";
    } else {
      try {
        await createDoc(c.env.DB, input);
        return c.redirect("/admin/docs?created=1", 303);
      } catch (error) {
        if (isUniqueSlugError(error)) {
          errors.slug = "这个 Slug 已经被占用了，请换一个。";
        } else {
          throw error;
        }
      }
    }
  }

  return c.html(adminEditorPage(c.get("settings"), values, errors, "create"), 422);
});

app.get("/admin/docs/:id/edit", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.html(adminNotFoundPage(c.get("settings")), 404);

  const doc = await getDocById(c.env.DB, id);
  if (!doc) return c.html(adminNotFoundPage(c.get("settings")), 404);

  return c.html(adminEditorPage(c.get("settings"), docToFormValues(doc), {}, "edit"));
});

app.post("/admin/docs/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.html(adminNotFoundPage(c.get("settings")), 404);

  const existing = await getDocById(c.env.DB, id);
  if (!existing) return c.html(adminNotFoundPage(c.get("settings")), 404);

  const body = await c.req.parseBody();
  const values: DocFormValues = { ...readDocForm(body), id };
  const { errors, input } = validateDoc(values);

  if (input) {
    if (await slugExists(c.env.DB, input.slug, id)) {
      errors.slug = "这个 Slug 已经被占用了，请换一个。";
    } else {
      try {
        const updated = await updateDoc(c.env.DB, id, input);
        if (!updated) return c.html(adminNotFoundPage(c.get("settings")), 404);
        return c.redirect("/admin/docs?updated=1", 303);
      } catch (error) {
        if (isUniqueSlugError(error)) {
          errors.slug = "这个 Slug 已经被占用了，请换一个。";
        } else {
          throw error;
        }
      }
    }
  }

  return c.html(adminEditorPage(c.get("settings"), values, errors, "edit"), 422);
});

app.post("/admin/docs/:id/delete", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.html(adminNotFoundPage(c.get("settings")), 404);

  const deleted = await deleteDoc(c.env.DB, id);
  if (!deleted) return c.html(adminNotFoundPage(c.get("settings")), 404);

  return c.redirect("/admin/docs?deleted=1", 303);
});

app.get("/admin/settings", (c) => {
  const settings = c.get("settings");
  const saved = c.req.query("saved") === "1" ? "站点设置已保存。" : null;
  return c.html(adminSettingsPage(settings, settings, {}, saved));
});

app.post("/admin/settings", async (c) => {
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > 2_500_000) {
    return c.text("上传内容过大，请压缩图片后重试。", 413);
  }

  const current = c.get("settings");
  const body = await c.req.parseBody();
  const values: SiteSettings = {
    site_title: formValue(body, "site_title").trim(),
    browser_title: formValue(body, "browser_title").trim(),
    site_description: formValue(body, "site_description").trim(),
    footer: formValue(body, "footer").trim(),
    favicon_key: current.favicon_key,
    logo_key: current.logo_key,
  };

  const faviconFile = uploadedFile(body["favicon"]);
  const logoFile = uploadedFile(body["logo"]);
  const removeFavicon = formValue(body, "remove_favicon") === "1";
  const removeLogo = formValue(body, "remove_logo") === "1";

  const errors: {
    site_title?: string;
    browser_title?: string;
    site_description?: string;
    footer?: string;
    favicon?: string;
    logo?: string;
  } = {};

  if (!values.site_title) errors.site_title = "请填写站点名称。";
  else if (values.site_title.length > 60) errors.site_title = "站点名称最多 60 个字符。";
  if (values.browser_title.length > 120) {
    errors.browser_title = "网页标题最多 120 个字符。";
  }
  if (values.site_description.length > 200) {
    errors.site_description = "站点简介最多 200 个字符。";
  }
  if (values.footer.length > 160) errors.footer = "页脚文字最多 160 个字符。";

  const faviconUpload = faviconFile ? validateUpload(faviconFile, "favicon") : null;
  if (faviconUpload && "error" in faviconUpload) {
    errors.favicon = faviconUpload.error;
  }
  const logoUpload = logoFile ? validateUpload(logoFile, "logo") : null;
  if (logoUpload && "error" in logoUpload) {
    errors.logo = logoUpload.error;
  }

  if (Object.keys(errors).length > 0) {
    return c.html(adminSettingsPage(current, values, errors, null), 422);
  }

  let faviconKey = values.favicon_key;
  let logoKey = values.logo_key;

  if (faviconFile && faviconUpload && "mime" in faviconUpload) {
    faviconKey = await storeUpload(c.env.DB, "favicon", faviconFile, faviconUpload.mime);
  } else if (removeFavicon) {
    faviconKey = "";
  }

  if (logoFile && logoUpload && "mime" in logoUpload) {
    logoKey = await storeUpload(c.env.DB, "logo", logoFile, logoUpload.mime);
  } else if (removeLogo) {
    logoKey = "";
  }

  const next: SiteSettings = { ...values, favicon_key: faviconKey, logo_key: logoKey };
  await saveSettings(c.env.DB, next);

  const oldKeys = new Set([current.favicon_key, current.logo_key]);
  for (const key of oldKeys) {
    if (key && key !== next.favicon_key && key !== next.logo_key) {
      await deleteAsset(c.env.DB, key).catch((error) => {
        console.error("Unable to remove old branding asset:", error);
      });
    }
  }

  return c.redirect("/admin/settings?saved=1", 303);
});

app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname;

  if (path === "/admin" || path.startsWith("/admin/")) {
    if (c.get("isAdmin")) {
      return c.html(adminNotFoundPage(c.get("settings")), 404);
    }
  }

  const docs = await listPublishedDocs(c.env.DB);
  return c.html(notFoundPage(c.get("settings"), docs, c.get("isAdmin")), 404);
});

app.onError((error, c) => {
  console.error("Unhandled request error:", error);
  return c.html(
    errorLayout(
      "服务暂时不可用",
      "请稍后重试。如果刚刚部署，请确认已经执行数据库迁移，并配置了 ADMIN_PASSWORD。",
    ),
    500,
  );
});

export default app;
