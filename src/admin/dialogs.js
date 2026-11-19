// Replaces the browser's own "OK / Cancel" pop-ups (window.confirm / window.alert) that Decap uses
// with dialogs that match the CMS, with plain-English wording.
//
// window.confirm has to answer immediately, so a styled dialog can't simply stand in for it. Instead:
// when Decap asks for confirmation straight after a click, we say "no" for now, show our dialog, and if
// the editor confirms we repeat their click, this time answering "yes". (Some actions ask twice, e.g.
// deleting with unsaved changes — each answer is remembered while the click is repeated.)
// A confirmation that isn't caused by a click (e.g. Decap offering to restore a backup on load) still
// uses the browser's pop-up, so nothing can get stuck.
(function () {
  const nativeConfirm = window.confirm.bind(window);

  const css = document.createElement("style");
  css.textContent = `
    .ebc-dlg-bg { position: fixed; inset: 0; z-index: 100000; background: rgba(49,61,62,.45);
      display: flex; align-items: center; justify-content: center; padding: 16px; animation: ebc-fade .12s ease-out; }
    .ebc-dlg { background: #fff; border-radius: 8px; width: 100%; max-width: 440px; padding: 24px 24px 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,.25); font-family: inherit; color: #313d3e; }
    .ebc-dlg h2 { margin: 0 0 8px; font-size: 19px; font-weight: 700; }
    .ebc-dlg p { margin: 0 0 22px; font-size: 15px; line-height: 1.5; color: #555a65; }
    .ebc-dlg-btns { display: flex; justify-content: flex-end; gap: 10px; }
    .ebc-dlg button { border: 0; border-radius: 5px; height: 36px; padding: 0 18px; font: inherit; font-size: 14px;
      font-weight: 700; cursor: pointer; }
    .ebc-dlg .cancel { background: #eff0f4; color: #313d3e; }
    .ebc-dlg .cancel:hover { background: #dfe0e6; }
    .ebc-dlg .ok { background: #313d3e; color: #fff; }
    .ebc-dlg .ok:hover { background: #555a65; }
    .ebc-dlg .ok.danger { background: #d3302f; }
    .ebc-dlg .ok.danger:hover { background: #b02020; }
    .ebc-dlg button:focus-visible { outline: 2px solid #3a69c7; outline-offset: 2px; }
    @keyframes ebc-fade { from { opacity: 0 } }`;
  document.head.appendChild(css);

  const pageTitle = () => {
    const input = document.querySelector('input[id^="title-field-"]');
    return input && input.value.trim() ? `“${input.value.trim()}”` : "This page";
  };

  // Decap's messages → friendlier wording. Anything not listed is shown as Decap wrote it.
  const WORDING = [
    [/delete this published entry, as well as your unsaved changes/i, () => ({
      title: "Delete this page?", danger: true, ok: "Delete page",
      text: `${pageTitle()} will be removed from the website, and the changes you haven't published will be lost.` })],
    [/delete this published entry/i, () => ({
      title: "Delete this page?", danger: true, ok: "Delete page",
      text: `${pageTitle()} will be removed from the website within a minute or two. If it's in the menu, remove it there too (Site settings → Menu).` })],
    [/leave this page|unsaved changes.*leave/i, () => ({
      title: "Leave without publishing?", danger: true, ok: "Leave", cancel: "Stay",
      text: "Your changes haven't been published, and nothing is kept until you click Publish. If you leave now they'll be lost." })],
    [/delete selected media|delete this file/i, () => ({
      title: "Delete this image?", danger: true, ok: "Delete",
      text: "It will be removed from the image library. Any page still using it will show a broken image." })],
    [/already exists\. Do you want to replace it/i, (m) => ({
      title: "Replace the existing image?", ok: "Replace", text: m.replace(/ Do you want to replace it\?$/, "") +
        ". Uploading will replace it everywhere it's used." })],
    [/unpublish/i, () => ({ title: "Unpublish this page?", danger: true, ok: "Unpublish",
      text: `${pageTitle()} will be taken off the website.` })],
    [/save before publishing/i, () => ({ title: "Save first", text: "Please save your changes before publishing." })],
  ];
  const describe = (message) => {
    for (const [re, make] of WORDING) if (re.test(message)) return make(message);
    return { title: "Are you sure?", text: message };
  };

  function showDialog({ title, text, ok = "OK", cancel = "Cancel", danger = false, alertOnly = false }) {
    return new Promise((resolve) => {
      const before = document.activeElement;
      const bg = document.createElement("div");
      bg.className = "ebc-dlg-bg";
      bg.innerHTML = `<div class="ebc-dlg" role="${alertOnly ? "alertdialog" : "dialog"}" aria-modal="true" aria-labelledby="ebc-dlg-t">
        <h2 id="ebc-dlg-t"></h2><p></p>
        <div class="ebc-dlg-btns">${alertOnly ? "" : `<button type="button" class="cancel"></button>`}
          <button type="button" class="ok${danger ? " danger" : ""}"></button></div></div>`;
      bg.querySelector("h2").textContent = title;
      bg.querySelector("p").textContent = text;
      bg.querySelector(".ok").textContent = ok;
      if (!alertOnly) bg.querySelector(".cancel").textContent = cancel;
      const done = (answer) => {
        document.removeEventListener("keydown", onKey, true);
        bg.remove();
        if (before && before.focus) before.focus();
        resolve(answer);
      };
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); }
        if (e.key === "Tab") { // keep focus inside the dialog
          const btns = [...bg.querySelectorAll("button")];
          const i = btns.indexOf(document.activeElement);
          e.preventDefault();
          btns[(i + (e.shiftKey ? btns.length - 1 : 1)) % btns.length].focus();
        }
      };
      bg.addEventListener("click", (e) => { if (e.target === bg) done(false); });
      bg.querySelector(".ok").addEventListener("click", () => done(true));
      bg.querySelector(".cancel")?.addEventListener("click", () => done(false));
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(bg);
      // For destructive actions start on Cancel, so pressing Enter by habit doesn't delete anything.
      bg.querySelector(danger && !alertOnly ? ".cancel" : ".ok").focus();
    });
  }

  // Remember the last real click, so it can be repeated once the editor confirms.
  let lastClick = null;
  document.addEventListener("click", (e) => {
    if (e.isTrusted) lastClick = { el: e.target, at: Date.now() };
  }, true);

  let approved = new Set(); // confirmations already answered "yes" while a click is being repeated
  let open = false;

  window.confirm = function (message) {
    message = String(message ?? "");
    if (approved.has(message)) return true;
    const click = lastClick;
    if (open || !click || Date.now() - click.at > 1500 || !click.el.isConnected) return nativeConfirm(message);
    lastClick = null;
    open = true;
    const info = describe(message);
    showDialog(info).then((yes) => {
      open = false;
      if (!yes) { approved = new Set(); return; }
      approved.add(message);
      if (/delete this published entry/i.test(message)) {
        const m = /^#\/collections\/([^/]+)\/entries\/(.+)$/.exec(location.hash);
        if (m) window.dispatchEvent(new CustomEvent("ebc:deleted", { detail: { collection: m[1], slug: decodeURIComponent(m[2]) } }));
      }
      lastClick = { el: click.el, at: Date.now() }; // a second question during the replay can ask again
      click.el.click();
      // Clear the remembered answers once this action has finished asking.
      setTimeout(() => { if (!open) approved = new Set(); }, 2000);
    });
    return false;
  };

  window.alert = function (message) {
    const info = describe(String(message ?? ""));
    showDialog({ ...info, title: info.title === "Are you sure?" ? "Please note" : info.title, alertOnly: true, danger: false });
  };
})();
