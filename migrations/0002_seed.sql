INSERT INTO settings (key, value) VALUES
  ('site_title', '页间'),
  ('site_description', '把零散的想法，整理成一页一页的文档。'),
  ('footer', '© 2026 页间 · 用文字记录日常')
ON CONFLICT(key) DO NOTHING;

INSERT INTO docs
  (slug, title, summary, content, sort_order, published, created_at, updated_at)
VALUES
  (
    'welcome',
    '欢迎来到页间',
    '这是你的第一篇文档，也是一张可以随意改写的地图。',
    '这里是 **页间**，一个可以部署在 Cloudflare 上的极简个人文档站。

它只有两个部分：

- **公开站点**：左侧是文档目录，右侧是正文。
- **管理后台**：登录后可以新建、编辑、排序和发布文档。

## 开始写作

1. 打开 [/admin](/admin) 并登录。
2. 点击「新建文档」，填写标题、Slug 和正文。
3. 保存后，文档会立即出现在左侧目录中。

> 文档使用 Markdown 编写。原始 HTML 默认不会被渲染，所以可以放心粘贴代码和链接。

## 关于这一页

这一页和「Markdown 速查」都是初始化数据。你可以在后台修改它们，或者直接删除，换成自己的内容。

祝写作愉快。',
    10,
    1,
    '2026-11-14T00:00:00.000Z',
    '2026-11-14T00:00:00.000Z'
  ),
  (
    'markdown',
    'Markdown 速查',
    '写作时最常用的 Markdown 语法，一页就够。',
    '## 标题

使用 `#` 到 `######` 创建不同层级的标题。

## 强调

`**粗体**`、`*斜体*`、`~~删除线~~`。

## 列表

- 无序列表
- 可以嵌套

1. 有序列表
2. 第二项

## 链接与图片

[链接文字](https://example.com)

图片语法是 `![图片描述](图片地址)`。

## 代码

行内代码：`const answer = 42`。

```ts
export default {
  async fetch(request: Request): Promise<Response> {
    return new Response("Hello, 页间");
  },
};
```

## 引用

> 把文档写短，把链接留长。

## 表格

| 语法 | 效果 |
| --- | --- |
| `**文字**` | 粗体 |
| `` `代码` `` | 行内代码 |

## 分隔线

---
',
    20,
    1,
    '2026-11-14T00:00:00.000Z',
    '2026-11-14T00:00:00.000Z'
  )
ON CONFLICT(slug) DO NOTHING;
