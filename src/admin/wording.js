// Plainer wording for a few of Decap's messages. Loaded before CMS.init (in preview.js).
//
// Decap's editor shows "Changes saved" / "Unsaved changes" next to the Publish button. On this site
// nothing is kept anywhere until Publish is clicked (Publish *is* saving: it puts the page live), so
// "Changes saved" on a page that was never published made editors think a draft had been stored.
// The status now says whether the website is up to date:
//   - "Not published yet"  – there are changes (or a whole new page) that only exist on this screen
//   - "Live on the website" – what's on screen is what visitors see
// Decap shows the second one on a brand-new, still-empty page too (it has no "new page" wording), so
// on new pages it's swapped for "Not published yet" below.
/* global CMS */
(function () {
  const NOT_PUBLISHED = "Not published yet";
  const LIVE = "Live on the website";

  const en = CMS.getLocale && CMS.getLocale("en");
  if (en && en.editor) {
    const copy = JSON.parse(JSON.stringify(en));
    Object.assign(copy.editor.editorToolbar, { unsavedChanges: NOT_PUBLISHED, changesSaved: LIVE });
    // Shown if the browser closed with changes that were never published (Decap keeps a copy in this
    // browser until the editor leaves the page).
    copy.editor.editor.confirmLoadBackup =
      "This page has changes from last time that were never published. Would you like to carry on with them?";
    CMS.registerLocale("en", copy);
  }

  // New pages: Decap says "Live on the website" until the first change is typed.
  const isNew = () => /\/new(?:[?/]|$)/.test(location.hash);
  const fix = () => {
    if (!isNew()) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue === LIVE ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    for (let n; (n = walker.nextNode());) {
      n.nodeValue = NOT_PUBLISHED; // change the text only, so React can keep updating it
      n.parentElement.style.color = "#ff003b"; // the colour Decap uses for unpublished changes
      n.parentElement.dataset.ebcNew = "1";
    }
  };
  // Decap reuses that label on the next page (e.g. once the new page is published, or when opening
  // another page), and doesn't rewrite text it thinks hasn't changed — so put the real wording back.
  const unfix = () => {
    if (isNew()) return;
    document.querySelectorAll("[data-ebc-new]").forEach((el) => {
      if (el.textContent === NOT_PUBLISHED) el.textContent = LIVE;
      el.style.color = "";
      delete el.dataset.ebcNew;
    });
  };
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fix(); unfix(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
