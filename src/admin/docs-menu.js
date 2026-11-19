// Adds "Docs" to the CMS sidebar, under Pages and Site settings. It shows buttons to the two
// guides (copied into the build at /admin/docs/ by eleventy.config.js); each opens in a new tab.
// Decap has no way to add a screen of our own, so the Docs screen lives at
// #/collections/settings?docs: Decap still draws its sidebar there, and this script swaps the
// main area for the Docs panel and moves the sidebar highlight to Docs.
(function () {
  const ROUTE = "#/collections/settings?docs";
  const DOCS = [
    {
      title: "How to edit the website",
      text: "Step by step, with pictures: signing in, editing and publishing pages, images, links, new pages, the menu and the footer.",
      href: "/admin/docs/editing-guide/",
    },
    {
      title: "How our website works",
      text: "The parts behind the website (GitHub, Cloudflare, Resend), and what happens when you sign in, publish, or a visitor sends a message.",
      href: "/admin/docs/how-the-website-works.html",
    },
  ];

  const css = document.createElement("style");
  css.textContent = `
    body.ebc-docs a.sidebar-active[class*="SidebarNavLink"]:not(.ebc-docs-link):not(:hover) {
      color: inherit; background-color: transparent; border-left-color: #fff; }
    body.ebc-docs [class*="CollectionMain"] > :not(.ebc-docs-panel) { display: none !important; }
    .ebc-docs-panel { padding-bottom: 40px; }
    .ebc-docs-head { background: #fff; border-radius: 5px; padding: 18px 20px; margin-bottom: 16px;
      box-shadow: 0 2px 6px 0 rgba(68,74,87,.05), 0 1px 3px 0 rgba(68,74,87,.1); }
    .ebc-docs-head h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #313d3e; }
    .ebc-docs-head p { margin: 0; color: #798291; font-size: 14px; line-height: 1.4; }
    .ebc-docs-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px 12px; }
    .ebc-doc { display: flex; flex-direction: column; gap: 8px; background: #fff; border-radius: 5px; padding: 20px;
      text-decoration: none; color: #313d3e; box-shadow: 0 2px 6px 0 rgba(68,74,87,.05), 0 1px 3px 0 rgba(68,74,87,.1); }
    .ebc-doc:hover { box-shadow: 0 4px 12px rgba(68,74,87,.2); }
    .ebc-doc strong { font-size: 17px; }
    .ebc-doc span { color: #798291; font-size: 14px; line-height: 1.45; flex: 1; }
    .ebc-doc em { align-self: flex-start; margin-top: 6px; font-style: normal; font-weight: 700; font-size: 14px;
      background: #313d3e; color: #fff; border-radius: 5px; padding: 0 16px; height: 36px; line-height: 36px; }
    .ebc-doc:hover em { background: #555a65; }`;
  document.head.appendChild(css);

  const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="no-fill" d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path class="no-fill" d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path class="no-fill" d="M9 7.5h6M9 10.5h6"/></svg>`;
  const NEW_TAB = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-left:6px"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`;
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const isDocs = () => location.hash === ROUTE;

  function ensureLink() {
    const settings = document.querySelector('a[class*="SidebarNavLink"][href="#/collections/settings"]');
    if (!settings) return;
    const list = settings.closest("ul");
    let link = list.querySelector("a.ebc-docs-link");
    if (!link) {
      const li = settings.closest("li").cloneNode(true);
      link = li.querySelector("a");
      link.className = settings.className.replace(/\bsidebar-active\b/, "").trim() + " ebc-docs-link";
      link.removeAttribute("aria-current");
      link.removeAttribute("data-testid");
      link.href = ROUTE;
      const icon = link.querySelector("span");
      link.textContent = "";
      if (icon) { icon.innerHTML = ICON; link.appendChild(icon); }
      link.appendChild(document.createTextNode("Docs"));
      list.appendChild(li);
    } else if (list.lastElementChild !== link.closest("li")) {
      list.appendChild(link.closest("li"));
    }
    link.classList.toggle("sidebar-active", isDocs());
  }

  function ensurePanel() {
    const main = document.querySelector('[class*="CollectionMain"]');
    const existing = document.querySelector(".ebc-docs-panel");
    if (!isDocs() || !main) { if (existing) existing.remove(); return; }
    if (existing && existing.parentElement === main) return;
    if (existing) existing.remove();
    const panel = document.createElement("div");
    panel.className = "ebc-docs-panel";
    panel.innerHTML =
      `<div class="ebc-docs-head"><h2>Docs</h2><p>Guides to the website. Each one opens in a new tab, and can be printed or saved as a PDF from there.</p></div>` +
      `<div class="ebc-docs-list">` +
      DOCS.map((d) => `<a class="ebc-doc" href="${d.href}" target="_blank" rel="noopener"><strong>${esc(d.title)}</strong><span>${esc(d.text)}</span><em>Open guide${NEW_TAB}</em></a>`).join("") +
      `</div>`;
    main.prepend(panel);
  }

  function refresh() {
    document.body.classList.toggle("ebc-docs", isDocs());
    ensureLink();
    ensurePanel();
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; refresh(); });
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", refresh);
})();
