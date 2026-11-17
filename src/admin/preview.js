// Styled live preview for Decap CMS.
// Renders the real Nunjucks page templates (bundled at build time into preview-templates.json)
// with whatever the editor is typing, so the preview looks exactly like the live site.
/* global CMS, createClass, h, nunjucks, markdownit */
(async function () {
  const T = await (await fetch("/admin/preview-templates.json", { cache: "no-store" })).json();
  const md = markdownit({ html: true, linkify: true });

  const Loader = nunjucks.Loader.extend({
    getSource(name) {
      if (!(name in T.templates)) throw new Error("Unknown template " + name);
      return { src: T.templates[name], path: name, noCache: true };
    },
  });
  const env = new nunjucks.Environment(new Loader(), { autoescape: true });
  env.addFilter("md", (s) => md.render(s || ""));
  env.addFilter("mdInline", (s) => md.renderInline(s || ""));
  // Same logic as menuActive in eleventy.config.js
  env.addFilter("menuActive", (item, url, nav) => {
    const norm = (u) => (u || "").replace(/\/+$/, "") || "/";
    const here = norm(url);
    const urls = [item.url, ...(item.children || []).map((c) => c.url)].filter(Boolean);
    if (urls.some((u) => norm(u) === here)) return true;
    return !!nav && (item.label || "").toLowerCase().replace(/\s+/g, "-") === nav;
  });

  // Swap image paths for previewable URLs (newly uploaded, unsaved images live in the browser).
  const resolveAssets = (v, getAsset) => {
    if (typeof v === "string") return /^\/(images|files)\//.test(v) ? String(getAsset(v) || v) : v;
    if (Array.isArray(v)) return v.map((x) => resolveAssets(x, getAsset));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveAssets(x, getAsset)]));
    return v;
  };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const wrap = (body, ctx) => env.render("header.njk", ctx) + `<main>${body}</main>` + env.render("footer.njk", ctx);

  const Preview = (render) =>
    createClass({
      render() {
        let html;
        try {
          const data = resolveAssets(this.props.entry.get("data").toJS(), this.props.getAsset);
          html = render(data);
        } catch (e) {
          html = `<pre style="color:#b00;padding:20px;white-space:pre-wrap">Preview not available: ${esc(e.message)}</pre>`;
        }
        return h("div", { dangerouslySetInnerHTML: { __html: html } });
      },
    });

  // Fixed pages: CMS entry name → template file (the data key is the entry name)
  const PAGES = {
    home: "index.njk", believe: "what-we-believe.njk", team: "meet-the-team.njk",
    history: "history-of-bath-elim.njk", building: "building.njk", kids: "lighthouse-kids.njk",
    toddlers: "little-friends-toddler-group.njk", ladies: "precious-ladies.njk", shoebox: "shoebox.njk",
    hire: "building-hire.njk", terms: "hireterms.njk", give: "give.njk", watch: "watch-again.njk",
  };
  for (const [name, file] of Object.entries(PAGES)) {
    const front = T.front[file] || {};
    CMS.registerPreviewTemplate(name, Preview((data) => {
      const ctx = { ...T.data, [name]: data, nav: front.nav, title: front.title, page: { url: front.permalink || "/" } };
      return wrap(env.render(file, ctx), ctx);
    }));
  }

  // Pages created in the CMS
  CMS.registerPreviewTemplate("custom_pages", Preview((data) => {
    const ctx = { ...T.data, ...data, content: md.render(data.body || ""), page: { url: "/new-page/" } };
    return wrap(env.render("page.njk", ctx), ctx);
  }));

  // Site settings: show the menu / footer they change
  CMS.registerPreviewTemplate("menu", Preview((data) => {
    const ctx = { ...T.data, menu: data, page: { url: "/" } };
    return env.render("header.njk", ctx) +
      `<p style="padding:30px 22px;color:#666;font:15px Arial">Menu preview — hover or click the items above to see the drop-downs.</p>`;
  }));
  CMS.registerPreviewTemplate("settings", Preview((data) => {
    const ctx = { ...T.data, settings: data, page: { url: "/" } };
    return wrap(`<p style="padding:40px 22px;color:#666;font:15px Arial">Footer preview ↓</p>`, ctx);
  }));
})()
  .catch((e) => console.error("CMS preview setup failed", e))
  .finally(() => {
    // Login goes through this site's own /api/auth (a Cloudflare Pages Function),
    // so base_url is wherever the site is being served from.
    CMS.init({ config: { backend: { base_url: window.location.origin } } });
  });
