// Puts everything about pages on one screen, and makes the page editor adapt to the chosen layout.
// Decap shows the fixed pages ("Pages") and the creatable pages ("New pages") as separate sidebar
// entries, because they are separate collections. This script hides the "New pages" entry and adds,
// on the Pages screen:
//   • a "+ New page" button, and
//   • a "New pages" list of every page created in the CMS (cards in grid view, rows in list view).
// In the page editor it shows only the fields that matter for the chosen Layout
// (Simple → Page content; Advanced → Opening text + Sections). Decap can't do conditional fields
// itself; hidden fields keep their content, so switching layout never loses anything.
// The list is read from src/pages/ through the same storage the CMS uses: the local
// decap-server when running on this computer, or GitHub (with the editor's login) on the live site.
// It adds to Decap's own screens; if a Decap update changes them, the extra area simply won't appear
// (the hidden collections stay reachable via Quick add).
(function () {
  const COLL = "custom_pages";
  const FOLDER = "src/pages";

  const css = document.createElement("style");
  css.textContent = `
    /* hide only the sidebar entry — the editor's back arrow links to the same place */
    a[class*="SidebarNavLink"][href="#/collections/${COLL}"] { display: none !important; }
    .ebc-hub { margin: 28px 0 40px; }
    .ebc-hub-head { display: flex; align-items: center; justify-content: space-between; gap: 16px;
      background: #fff; border-radius: 5px; box-shadow: 0 2px 6px 0 rgba(68,74,87,.05), 0 1px 3px 0 rgba(68,74,87,.1);
      padding: 18px 20px; margin-bottom: 16px; }
    .ebc-hub-head h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #313d3e; }
    .ebc-hub-head p { margin: 0; color: #798291; font-size: 14px; line-height: 1.4; }
    .ebc-new { position: relative; flex: none; }
    .ebc-new-btn { display: inline-block; background: #313d3e; color: #fff !important; border-radius: 5px; padding: 0 18px; height: 36px;
      font-weight: 700; font-size: 14px; line-height: 36px; text-decoration: none; white-space: nowrap; }
    .ebc-new-btn:hover { background: #555a65; }
    .ebc-top-new { margin-left: auto; }
    .ebc-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px 12px; }
    .ebc-card { display: flex; flex-direction: column; height: 240px; background: #fff; border-radius: 5px; overflow: hidden;
      text-decoration: none; color: #313d3e; box-shadow: 0 2px 6px 0 rgba(68,74,87,.05), 0 1px 3px 0 rgba(68,74,87,.1); }
    .ebc-card:hover { box-shadow: 0 4px 12px rgba(68,74,87,.2); }
    .ebc-card-title { display: flex; align-items: baseline; gap: 6px; padding: 9px 14px; font-size: 15px; font-weight: 600; }
    .ebc-card-title .t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .ebc-card-title .ebc-badge { flex: none; margin-left: auto; }
    .ebc-card-title small, .ebc-row small { color: #798291; font-weight: 400; }
    .ebc-badge { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      padding: 2px 6px; border-radius: 3px; margin-left: 6px; vertical-align: 1px; background: #eff0f4; color: #555a65; }
    .ebc-badge.adv { background: #e8f5fe; color: #3a69c7; }
    .ebc-rows { display: grid; gap: 6px; }
    .ebc-row { display: block; background: #fff; border-radius: 5px; padding: 14px 20px; text-decoration: none; color: #313d3e;
      font-size: 15px; font-weight: 600; box-shadow: 0 2px 6px 0 rgba(68,74,87,.05), 0 1px 3px 0 rgba(68,74,87,.1); }
    .ebc-row:hover { color: #3a69c7; }
    .ebc-empty { color: #798291; padding: 8px 4px; }`;
  document.head.appendChild(css);

  // ---- reading the list of new pages ----
  let cache = null;
  // Pages deleted in the last couple of minutes. GitHub can take a moment to reflect a deletion,
  // so these are left out of the list even if a slightly stale listing still includes them.
  const DELETED_KEY = "ebc-recently-deleted";
  const recentlyDeleted = () => {
    try {
      const all = JSON.parse(sessionStorage.getItem(DELETED_KEY) || "{}");
      for (const k of Object.keys(all)) if (Date.now() - all[k] > 120000) delete all[k];
      return all;
    } catch { return {}; }
  };
  window.addEventListener("ebc:deleted", (e) => {
    if (e.detail.collection !== COLL) return;
    const all = recentlyDeleted();
    all[e.detail.slug] = Date.now();
    try { sessionStorage.setItem(DELETED_KEY, JSON.stringify(all)); } catch {}
  });
  const parse = (text, path) => {
    const fm = (/^---\n([\s\S]*?)\n---/.exec(text) || [])[1] || "";
    const get = (k) => ((new RegExp(`^${k}:\\s*(.*)$`, "m").exec(fm) || [])[1] || "").trim().replace(/^(['"])(.*)\1$/, "$2");
    const slug = path.split("/").pop().replace(/\.md$/, "");
    return { slug, title: get("title") || slug, mode: get("layout_mode") === "sections" ? "sections" : "simple" };
  };
  async function loadPages() {
    let user = {};
    try { user = JSON.parse(localStorage.getItem("decap-cms-user") || "{}"); } catch {}
    if (user.backendName === "proxy") {
      const res = await fetch("http://localhost:8081/api/v1", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "entriesByFolder", params: { branch: "main", folder: FOLDER, extension: "md", depth: 1 } }),
      });
      return (await res.json()).map((e) => parse(e.data, e.file.path));
    }
    if (!user.token) return [];
    const cfg = await (await fetch("/admin/config.yml", { cache: "no-store" })).text();
    const repo = (/^\s*repo:\s*(\S+)/m.exec(cfg) || [])[1];
    const branch = (/^\s*branch:\s*(\S+)/m.exec(cfg) || [])[1] || "main";
    // cache: "no-store" — GitHub lets browsers reuse a listing for 60 seconds, which would show
    // deleted pages as still there (and hide brand-new ones) for up to a minute.
    const gh = (path, raw) => fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, {
      cache: "no-store",
      headers: { Authorization: `token ${user.token}`, Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json" },
    });
    const res = await gh(FOLDER);
    if (!res.ok) return [];
    const files = (await res.json()).filter((f) => f.type === "file" && f.name.endsWith(".md"));
    return Promise.all(files.map(async (f) => parse(await (await gh(f.path, true)).text(), f.path)));
  }
  const refresh = () => {
    cache = loadPages()
      .then((list) => { const gone = recentlyDeleted(); return list.filter((p) => !gone[p.slug]); })
      .then((list) => list.sort((a, b) => a.title.localeCompare(b.title)))
      .catch((e) => { console.warn("Could not list new pages", e); return null; });
    return cache;
  };

  // shared with link-widget.js (suggests pages when typing a link)
  window.EBC = window.EBC || {};
  window.EBC.listCustomPages = () => cache || refresh();

  // ---- building the UI ----
  const newButton = (extraClass) => {
    const wrap = document.createElement("div");
    wrap.className = "ebc-new " + (extraClass || "");
    wrap.innerHTML = `<a class="ebc-new-btn" href="#/collections/${COLL}/new">+ New page</a>`;
    return wrap;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const entryHref = (p) => `#/collections/${COLL}/entries/${p.slug}`;
  const badge = (p) => p.mode === "sections" ? `<span class="ebc-badge adv">Advanced</span>` : `<span class="ebc-badge">Simple</span>`;

  function renderList(hub, list, grid) {
    const body = hub.querySelector(".ebc-body");
    body.dataset.view = grid ? "grid" : "list";
    if (list === null) { body.innerHTML = `<p class="ebc-empty">Couldn't load the list of new pages. Try refreshing the page.</p>`; return; }
    if (!list.length) { body.innerHTML = `<p class="ebc-empty">No new pages yet. Click <strong>+ New page</strong> to create one.</p>`; return; }
    body.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = grid ? "ebc-cards" : "ebc-rows";
    for (const p of list) {
      const a = document.createElement("a");
      a.href = entryHref(p);
      if (grid) {
        a.className = "ebc-card";
        a.innerHTML = `<div class="ebc-card-title"><span class="t">${esc(p.title)} <small>/${esc(p.slug)}</small></span>${badge(p)}</div>`;
        const url = window.EBC && window.EBC.urlFor("#/collections/" + COLL + "/entries/" + p.slug);
        if (url) a.appendChild(window.EBC.makePreviewBox(url));
      } else {
        a.className = "ebc-row";
        a.innerHTML = `${esc(p.title)} <small>— /${esc(p.slug)}</small>${badge(p)}`;
      }
      wrap.appendChild(a);
    }
    body.appendChild(wrap);
  }

  // ---- page editor: show the fields for the chosen Layout ----
  function adaptEditor() {
    if (!new RegExp(`^#/collections/${COLL}/(new|entries/)`).test(location.hash)) return;
    // The back arrow says "Writing in New pages collection", but there's no "New pages" in the
    // sidebar any more (it goes back to Pages), so call it that.
    const back = document.querySelector(`a[href="#/collections/${COLL}"]:not([class*="SidebarNavLink"])`);
    if (back) {
      const walk = document.createTreeWalker(back, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode()); ) {
        if (/Writing in/.test(n.textContent)) { n.textContent = "Back to Pages"; break; }
        if (/^\s*New pages\s*$/.test(n.textContent) || /^\s*collection\s*$/.test(n.textContent)) n.textContent = "";
      }
    }
    const field = (name) => {
      const label = document.querySelector(`label[for^="${name}-field-"]`);
      return label && { label, box: label.closest('[class*="ControlContainer"]') };
    };
    const layout = field("layout_mode"), body = field("body"), sections = field("sections");
    if (!layout || !layout.box) return;
    const advanced = /Advanced/.test(layout.box.querySelector('[class*="singleValue"]')?.textContent || layout.box.textContent.replace(layout.label.textContent, ""));
    if (sections?.box) sections.box.style.display = advanced ? "" : "none";
    if (body?.label) {
      const t = body.label.firstChild;
      const want = advanced ? "Opening text" : "Page content";
      if (t && t.nodeType === 3 && !t.textContent.startsWith(want)) t.textContent = t.textContent.replace(/^(Page content|Opening text)/, want);
    }
  }

  // Decap gives the title box, the view/sort bar and the list-view rows a fixed width (682px), but the
  // thumbnail grid fills the screen, so the screen got narrower when switching from grid to list.
  // Work out where the grid's last column ends (from the space available, so it's the same in both
  // views) and make all of them that wide (Pages, Site settings).
  const GRID_PITCH = 347; // a grid card (335px) plus the 12px gap, as Decap draws them
  let wideRight = NaN;
  function alignTop() {
    const onList = /^#\/collections\/[^/]+\/?$/.test(location.hash.replace(/\?.*$/, ""));
    const main = onList && document.querySelector('[class*="CollectionMain"]');
    wideRight = NaN;
    if (main) {
      // The grid starts 12px left of the content area (Decap's gap), so it has 12px more room.
      const st = getComputedStyle(main), r = main.getBoundingClientRect();
      const left = r.left + parseFloat(st.paddingLeft) - 12;
      const room = r.right - parseFloat(st.paddingRight) - left;
      const li = document.querySelector('li[class*="GridCard"]');
      const pitch = li && li.offsetWidth ? li.offsetWidth + parseFloat(getComputedStyle(li).marginLeft) : GRID_PITCH;
      // always a full row, so every screen (Pages, Site settings, Docs) is the same width
      if (room > 0) wideRight = left + Math.max(1, Math.floor((room + 0.5) / pitch)) * pitch;
    }
    const els = [...document.querySelectorAll('[class*="CollectionTopContainer"], [class*="CollectionControlsContainer"], li[class*="ListCard"], .ebc-docs-panel')];
    for (const el of els) {
      const w = isFinite(wideRight) ? Math.max(0, wideRight - el.getBoundingClientRect().left) + "px" : "";
      if (el.style.width !== w) { el.style.width = w; el.style.maxWidth = w ? "none" : ""; }
    }
  }

  function ensureHub() {
    adaptEditor();
    alignTop();
    const route = location.hash.replace(/\?.*$/, "");
    // The new-pages list has no sidebar entry: send its list screen to Pages.
    if (route === `#/collections/${COLL}`) {
      location.replace("#/collections/pages");
      return;
    }
    if (route !== "#/collections/pages") {
      // Decap reuses the heading area on other collection screens, so take the button away there.
      document.querySelectorAll(".ebc-top-new").forEach((b) => b.remove());
      return;
    }
    const firstCard = document.querySelector('a[href^="#/collections/pages/entries/"]');
    if (!firstCard) return;
    const grid = !!document.querySelector('a[class*="GridCardLink"]');

    // "+ New page" next to the Pages heading at the top
    const heading = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "Pages");
    if (heading && !heading.parentElement.querySelector(".ebc-top-new")) {
      heading.parentElement.style.display = "flex";
      heading.parentElement.style.alignItems = "center";
      heading.parentElement.appendChild(newButton("ebc-top-new"));
    }

    // "New pages" area under the fixed pages
    const container = firstCard.closest("ul") || firstCard.parentElement.parentElement;
    let hub = document.querySelector(".ebc-hub");
    if (!hub || hub.previousElementSibling !== container) {
      hub?.remove();
      hub = document.createElement("section");
      hub.className = "ebc-hub";
      hub.innerHTML = `<div class="ebc-hub-head"><div><h2>New pages</h2>
        <p>Pages you've created. Each page's Layout is Simple (one block of text and photos) or Advanced (built from sections).
        Add new pages to the menu under Site settings → Menu.</p></div></div>
        <div class="ebc-body"><p class="ebc-empty">Loading…</p></div>`;
      hub.querySelector(".ebc-hub-head").appendChild(newButton());
      container.after(hub);
      (cache || refresh()).then((list) => renderList(hub, list, grid));
    } else if (hub.querySelector(".ebc-body").dataset.view !== (grid ? "grid" : "list") && cache) {
      cache.then((list) => renderList(hub, list, grid));
    }
    // Line the header up with the right edge of the cards above (worked out in alignTop). Measured
    // every time, because the cards are still being laid out when the area is first added.
    const right = wideRight;
    if (isFinite(right) && right > 0) {
      const w = Math.max(0, right - hub.getBoundingClientRect().left) + "px";
      if (hub.style.maxWidth !== w) hub.style.maxWidth = w;
    }
  }

  window.addEventListener("hashchange", () => { if (location.hash.startsWith("#/collections/pages")) refresh(); });
  window.addEventListener("resize", () => requestAnimationFrame(ensureHub));
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; ensureHub(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
