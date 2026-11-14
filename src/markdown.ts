import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

const fallbackLinkOpen = md.renderer.rules.link_open;

md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const href = String(token?.attrGet("href") ?? "");

  if (token && /^https?:\/\//i.test(href)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }

  if (fallbackLinkOpen) {
    return fallbackLinkOpen(tokens, index, options, env, self);
  }
  return self.renderToken(tokens, index, options);
};

export function renderMarkdown(source: string): string {
  const tokens = md.parse(source, {});
  const used = new Map<string, number>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.type !== "heading_open") continue;

    const inline = tokens[index + 1];
    if (!inline || inline.type !== "inline") continue;

    const base =
      inline.content
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .trim()
        .replace(/\s+/g, "-") || "section";
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    token.attrSet("id", count === 0 ? base : `${base}-${count + 1}`);
  }

  return md.renderer.render(tokens, md.options, {});
}
