// "pagelink" widget: a link box that suggests the site's pages as you type, so editors don't need to
// know page addresses. Pick a page from the list (shown by name, with its address), or type any
// address, e.g. a YouTube link. The saved value is a plain address like "/give", the same as before.
// Its instructions show only while the box is empty (use `help:` in config.yml, not `hint:`, which
// Decap would show all the time).
// Built-in pages come from preview.js (EBC.builtInPages); pages created in the CMS are read live by
// pages-hub.js (EBC.listCustomPages), so a page appears here as soon as it has been saved.
/* global CMS, createClass, h */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    .ebc-link { position: relative; }
    .ebc-link-list { position: absolute; z-index: 300; left: 0; right: 0; top: 100%; margin: 2px 0 0; padding: 4px 0;
      list-style: none; background: #fff; border: 2px solid #3a69c7; border-radius: 0 0 5px 5px; max-height: 280px;
      overflow-y: auto; box-shadow: 0 6px 18px rgba(68,74,87,.18); }
    .ebc-link-list li { display: flex; align-items: baseline; gap: 10px; padding: 8px 14px; cursor: pointer; font-size: 14px; }
    .ebc-link-list li.on { background: #e8f5fe; }
    .ebc-link-list .t { font-weight: 600; color: #313d3e; }
    .ebc-link-list .u { color: #798291; font-size: 13px; margin-left: auto; white-space: nowrap; }
    .ebc-link-list .tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #3a69c7; }
    .ebc-link-list .head { cursor: default; padding: 6px 14px 2px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .05em; color: #798291; }
    .ebc-link-note { margin: 6px 0 0; font-size: 13px; color: #798291; }
    .ebc-link-note.warn { color: #b05a00; }
    .ebc-link-help { margin: 6px 0 0; font-size: 12px; line-height: 1.4; color: #798291; }`;
  document.head.appendChild(css);

  const norm = (u) => (u || "").trim().replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";

  async function loadAll() {
    const E = window.EBC || {};
    const pages = (E.builtInPages || []).slice();
    try {
      const custom = (await (E.listCustomPages ? E.listCustomPages() : null)) || [];
      for (const p of custom) {
        const u = E.urlFor ? E.urlFor(`#/collections/custom_pages/entries/${p.slug}`) : `/${p.slug}/`;
        pages.push({ title: p.title, url: E.noSlash ? E.noSlash(u) : norm(u), kind: "new" });
      }
    } catch (e) { /* built-in pages still work */ }
    return pages;
  }

  const Control = createClass({
    getInitialState() { return { open: false, pages: null, hi: 0, typed: false }; },
    componentDidMount() { this.load(); },
    load() { loadAll().then((pages) => this.setState({ pages })); },
    value() { return this.props.value || ""; },
    matches() {
      const pages = this.state.pages || [];
      const q = this.value().trim().toLowerCase();
      // Until the editor types, show every page (so clicking into a filled-in box still offers the list).
      if (!this.state.typed || !q) return pages;
      return pages.filter((p) => p.title.toLowerCase().includes(q) || p.url.toLowerCase().includes(q.replace(/^https?:\/\/(www\.)?elimbath\.org/, "")));
    },
    pick(p) {
      this.setState({ open: false, typed: false });
      // Fill the label first and set the link once Decap has taken that in — two changes to the same
      // menu item at once would overwrite each other.
      if (this.fillLabel(p.title)) setTimeout(() => this.props.onChange(p.url), 60);
      else this.props.onChange(p.url);
    },
    // Menu items: if the item's Label is still empty, fill it in with the page's name.
    fillLabel(title) {
      let el = document.getElementById(this.props.forID);
      while (el && (el = el.parentElement)) {
        const label = el.querySelector('input[id^="label-field-"]');
        if (!label) continue;
        if (!label.value.trim()) {
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          set.call(label, title);
          label.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      }
      return false;
    },
    onKey(e) {
      const list = this.matches();
      if (!this.state.open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { this.setState({ open: true, hi: 0 }); e.preventDefault(); return; }
      if (!this.state.open || !list.length) return;
      if (e.key === "ArrowDown") { this.setState({ hi: (this.state.hi + 1) % list.length }); e.preventDefault(); }
      else if (e.key === "ArrowUp") { this.setState({ hi: (this.state.hi - 1 + list.length) % list.length }); e.preventDefault(); }
      else if (e.key === "Enter") { this.pick(list[Math.min(this.state.hi, list.length - 1)]); e.preventDefault(); }
      else if (e.key === "Escape") { this.setState({ open: false }); e.preventDefault(); e.stopPropagation(); }
    },
    render() {
      const { forID, classNameWrapper, setActiveStyle, setInactiveStyle } = this.props;
      const value = this.value();
      const pages = this.state.pages || [];
      const list = this.matches();
      const hi = Math.min(this.state.hi, Math.max(0, list.length - 1));

      // Under the box: which page this links to, or a gentle warning if it's an address on this site
      // that doesn't match any page.
      let note = null;
      if (value.trim() && this.state.pages) {
        const here = pages.find((p) => norm(p.url) === norm(value));
        if (here) note = h("p", { className: "ebc-link-note" }, "Links to: ", h("strong", null, here.title));
        else if (/^https?:\/\//i.test(value.trim())) note = h("p", { className: "ebc-link-note" }, "Links to another website (opens in a new tab).");
        else if (/^\//.test(value.trim()) && !/^\/(files|images)\//.test(value.trim()))
          note = h("p", { className: "ebc-link-note warn" }, "There's no page at this address yet — pick one from the list, or check the spelling.");
      }

      // Instructions only while the link still needs sorting out (empty, or half-typed like "giv"):
      // once a page is picked or a web address typed, "Links to: …" takes their place, and a wrong
      // address gets the warning instead. (Set per field with `help:` in config.yml.)
      const fileLink = /^\/(files|images)\//.test(value.trim());
      const help = !note && !fileLink
        ? h("p", { className: "ebc-link-help" }, (this.props.field && this.props.field.get("help")) ||
            "Start typing a page name and pick it from the list, or paste a full web address (https://…).")
        : null;

      const items = [];
      let lastKind = null;
      list.forEach((p, i) => {
        if (p.kind !== lastKind && pages.some((x) => x.kind === "new")) {
          items.push(h("li", { key: "h-" + p.kind, className: "head" }, p.kind === "new" ? "Pages you've created" : "Main pages"));
          lastKind = p.kind;
        }
        items.push(h("li", {
          key: p.kind + p.url, className: i === hi ? "on" : "",
          onMouseDown: (e) => { e.preventDefault(); this.pick(p); },
          onMouseEnter: () => this.setState({ hi: i }),
        }, h("span", { className: "t" }, p.title), h("span", { className: "u" }, p.url)));
      });

      return h("div", { className: "ebc-link" },
        h("input", {
          type: "text", id: forID, className: classNameWrapper, value, autoComplete: "off",
          placeholder: "Start typing a page name, e.g. Give — or paste a web address",
          role: "combobox", "aria-expanded": this.state.open, "aria-autocomplete": "list",
          onChange: (e) => { this.props.onChange(e.target.value); this.setState({ open: true, typed: true, hi: 0 }); },
          onFocus: () => { setActiveStyle(); this.setState({ open: true, typed: false, hi: 0 }); this.load(); },
          onBlur: () => { setInactiveStyle(); this.setState({ open: false }); },
          onKeyDown: (e) => this.onKey(e),
        }),
        this.state.open && list.length ? h("ul", { className: "ebc-link-list", role: "listbox" }, items) : null,
        note, help);
    },
  });

  CMS.registerWidget("pagelink", Control);
})();
