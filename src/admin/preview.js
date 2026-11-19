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
  env.addFilter("isExternal", (u) => /^https?:\/\//i.test(u || "")); // same as eleventy.config.js
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
  // Menu: when the editor changes an item's sub-items (adds, edits or removes one), open that item's
  // drop-down in the preview so they can see it; editing a main item closes it again. (The preview
  // only receives the menu's content, not which box has focus, so this works from what changed.)
  // On a narrow preview the mobile menu is shown opened, which lists every sub-item anyway.
  let lastItems = null;
  let openIndex = null;
  const sameJSON = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  CMS.registerPreviewTemplate("menu", Preview((data) => {
    const items = data.items || [];
    if (lastItems) {
      if (items.length !== lastItems.length) openIndex = null;
      else {
        const sub = items.findIndex((it, i) => !sameJSON(it.children, lastItems[i].children));
        const main = items.findIndex((it, i) => it.label !== lastItems[i].label || it.url !== lastItems[i].url);
        if (sub >= 0) openIndex = sub;
        else if (main >= 0) openIndex = null;
      }
    }
    lastItems = JSON.parse(JSON.stringify(items));

    const ctx = { ...T.data, menu: data, page: { url: "/" } };
    const doc = new DOMParser().parseFromString(env.render("header.njk", ctx), "text/html");
    doc.querySelector(".nav")?.classList.add("open");
    const li = openIndex === null ? null : doc.querySelectorAll(".nav > ul > li")[openIndex];
    if (li && li.querySelector(".sub")) li.classList.add("open");
    return doc.body.innerHTML +
      `<p style="padding:30px 22px;color:#666;font:15px Arial">Menu preview — hover or click the items above to see the drop-downs. ` +
      `While you edit an item's sub-items, its drop-down stays open here.</p>`;
  }));
  // Also follow where the editor is typing: clicking into a sub-item opens its drop-down at once,
  // clicking into a main item closes it (the preview doesn't re-render on focus, so update it here).
  document.addEventListener("focusin", (e) => {
    if (!/\/settings\/entries\/menu/.test(location.hash) || !lastItems) return;
    let subs = null;
    for (let el = e.target; el && el !== document.body; el = el.parentElement) {
      if (el.querySelector(':scope > label[for^="children-field-"], :scope > * > label[for^="children-field-"]')) { subs = el; break; }
    }
    let index = null;
    if (subs) {
      for (let el = subs.parentElement; el && el !== document.body; el = el.parentElement) {
        const label = el.querySelector('input[id^="label-field-"]');
        if (label) { index = lastItems.findIndex((it) => it.label === label.value); break; }
      }
      if (index < 0) index = null;
    }
    if (index === openIndex) return;
    openIndex = index;
    const frame = [...document.querySelectorAll("iframe")].find((f) => f.contentDocument?.querySelector(".site-header"));
    frame?.contentDocument.querySelectorAll(".nav > ul > li").forEach((li, i) =>
      li.classList.toggle("open", i === openIndex && !!li.querySelector(".sub")));
  });
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
  // Site settings cards show the part of the site they change, not the whole home page:
  //   Menu   → the home page at phone width with the menu opened (it lists every item and sub-item)
  //   Footer → the bottom of the home page (the frame is made as tall as the whole page and shifted
  //            up, rather than scrolled, because browsers reset a frame's scroll position on reload)
  const CARD_VIEWS = {
    "settings/menu": { width: 480, header: 0, ready: (doc) => doc.querySelector(".nav")?.classList.add("open") },
    "settings/settings": { bottom: true },
  };
  const viewFor = (href) => {
    const m = /#\/collections\/([^/]+)\/entries\/([^/?#]+)/.exec(href || "");
    return (m && CARD_VIEWS[`${m[1]}/${m[2]}`]) || null;
  };
  const fit = (box) => {
    const frame = box.firstChild;
    if (!frame) return;
    const width = +box.dataset.width || SITE_WIDTH;
    const scale = box.clientWidth / width;
    let shift = box.dataset.header !== undefined ? +box.dataset.header : HEADER;
    if (box.dataset.bottom) {
      let pageHeight = 0;
      try { pageHeight = frame.contentDocument.documentElement.scrollHeight; } catch (e) { /* not loaded yet */ }
      const visible = scale > 0 ? box.clientHeight / scale : 0;
      if (pageHeight > visible && visible > 0) {
        frame.style.height = pageHeight + "px";
        shift = pageHeight - visible;
      }
    } else if (box.dataset.view && scale > 0 && box.clientHeight > 0) {
      frame.style.height = Math.ceil(box.clientHeight / scale + shift) + "px";
    }
    frame.style.width = width + "px";
    frame.style.transform = `scale(${scale}) translateY(-${shift}px)`;
  };
  const resizer = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target)));
  const makePreviewBox = (url, view) => {
    const box = document.createElement("div");
    box.className = "ebc-card-preview";
    box.dataset.url = url;
    if (view) {
      box.dataset.view = "1";
      if (view.width) box.dataset.width = view.width;
      if (view.header !== undefined) box.dataset.header = view.header;
      if (view.bottom) box.dataset.bottom = "1";
    }
    const frame = document.createElement("iframe");
    frame.src = url + "?card-preview";
    frame.loading = "lazy";
    frame.tabIndex = -1;
    frame.title = "";
    frame.setAttribute("aria-hidden", "true");
    if (view) {
      // Once the page has loaded (and a little later, as photos and fonts change its height),
      // apply the view and line the card up again.
      const apply = () => {
        try { if (view.ready) view.ready(frame.contentDocument, frame.contentWindow); } catch (e) { /* shows the top of the page */ }
        fit(box);
      };
      frame.addEventListener("load", () => [0, 500, 2000].forEach((ms) => setTimeout(apply, ms)));
    }
    box.appendChild(frame);
    requestAnimationFrame(() => fit(box));
    resizer.observe(box);
    return box;
  };
  const addCardPreviews = () => {
    document.querySelectorAll('a[class*="GridCardLink"]').forEach((card) => {
      const href = card.getAttribute("href");
      const url = urlFor(href);
      // Decap reuses card elements between screens, so compare the entry, not just the address
      // (Home, Menu and Footer all show "/").
      const key = (href || "").replace(/^.*#/, "");
      const existing = card.querySelector(".ebc-card-preview");
      if (existing && existing.dataset.key === key) return;
      existing?.remove();
      if (!url) return;
      const box = makePreviewBox(url, viewFor(href));
      box.dataset.key = key;
      card.appendChild(box);
    });
  };
  // used by pages-hub.js (the "New pages" area on the Pages screen) and link-widget.js
  const noSlash = (u) => (u === "/" ? u : u.replace(/\/+$/, ""));
  const builtInPages = Object.keys(PAGES).map((name) => ({
    title: (T.pageLabels || {})[name] || name, url: noSlash(pageUrl[name] || "/"), kind: "page" }));
  window.EBC = Object.assign(window.EBC || {}, { urlFor, makePreviewBox, builtInPages, noSlash });
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
