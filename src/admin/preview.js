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
  const customPage = Preview((data) => {
    const ctx = { ...T.data, ...data, content: md.render(data.body || ""), page: { url: "/new-page/" } };
    return wrap(env.render("page.njk", ctx), ctx);
  });
  CMS.registerPreviewTemplate("custom_pages", customPage);

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


  // ---------- Mini page previews on the grid-view cards ----------
  // In grid view each card gets a scaled-down copy of the *published* page. Previews only load
  // for cards on screen (lazy iframes), and slideshows are paused inside them (?card-preview).
  // This adds to Decap's own card markup; if a Decap update changes it, previews just won't appear.
  const pageUrl = {};
  for (const [name, file] of Object.entries(PAGES)) pageUrl[name] = (T.front[file] || {}).permalink || "/";
  const reserved = new Set(["admin", "api", "images", "css", "js", "files",
    ...Object.keys(T.templates).filter((k) => !k.includes("/") && k.endsWith(".njk")).map((k) => k.replace(/\.njk$/, ""))]);
  const urlFor = (href) => {
    const m = /#\/collections\/([^/]+)\/entries\/([^/?#]+)/.exec(href || "");
    if (!m) return null;
    const [, coll, slug] = m;
    if (coll === "pages") return pageUrl[slug] || null;
    if (coll === "custom_pages") return `/${reserved.has(slug) ? slug + "-2" : slug}/`;
    if (coll === "settings") return "/"; // menu & footer: show the home page
    return null;
  };
  const SITE_WIDTH = 1280;
  const HEADER = 76; // skip the site header (same on every page) so the card shows the page itself
  const fit = (box) => {
    const frame = box.firstChild;
    if (frame) frame.style.transform = `scale(${box.clientWidth / SITE_WIDTH}) translateY(-${HEADER}px)`;
  };
  const resizer = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target)));
  const makePreviewBox = (url) => {
    const box = document.createElement("div");
    box.className = "ebc-card-preview";
    box.dataset.url = url;
    const frame = document.createElement("iframe");
    frame.src = url + "?card-preview";
    frame.loading = "lazy";
    frame.tabIndex = -1;
    frame.title = "";
    frame.setAttribute("aria-hidden", "true");
    box.appendChild(frame);
    requestAnimationFrame(() => fit(box));
    resizer.observe(box);
    return box;
  };
  const addCardPreviews = () => {
    document.querySelectorAll('a[class*="GridCardLink"]').forEach((card) => {
      const url = urlFor(card.getAttribute("href"));
      const existing = card.querySelector(".ebc-card-preview");
      if (existing && existing.dataset.url === url) return;
      existing?.remove();
      if (!url) return;
      card.appendChild(makePreviewBox(url));
    });
  };
  // used by pages-hub.js (the "New pages" area on the Pages screen)
  window.EBC = { urlFor, makePreviewBox };
  const style = document.createElement("style");
  style.textContent = `
    a[class*="GridCardLink"]:has(.ebc-card-preview) { display: flex !important; flex-direction: column; height: 100% !important; }
    a[class*="GridCardLink"]:has(.ebc-card-preview) [class*="CardBody"] { height: auto !important; flex: none; padding: 9px 14px !important; }
    a[class*="GridCardLink"]:has(.ebc-card-preview) [class*="CardHeading"] { margin: 0 !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block !important; }
    .ebc-card-preview { position: relative; flex: 1; min-height: 0; overflow: hidden; border-top: 1px solid #e3e6ec;
      background: #f3f4f7; pointer-events: none; border-radius: 0 0 5px 5px; }
    .ebc-card-preview iframe { position: absolute; top: 0; left: 0; width: ${SITE_WIDTH}px; height: 1000px;
      border: 0; transform-origin: 0 0; background: #fff; }`;
  document.head.appendChild(style);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; addCardPreviews(); });
  }).observe(document.body, { childList: true, subtree: true });
})()
  .catch((e) => console.error("CMS preview setup failed", e))
  .finally(() => {
    // Login goes through this site's own /api/auth (a Cloudflare Pages Function),
    // so base_url is wherever the site is being served from.
    CMS.init({ config: { backend: { base_url: window.location.origin } } });
  });
