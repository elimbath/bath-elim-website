// Every page created in the CMS (src/pages/*.md) uses the page.njk layout and lives at /<file-name>/.
// If that address is already taken by a built-in page or folder, it gets "-2" added instead of
// breaking the build (e.g. a new page called "Give" becomes /give-2/).
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..");
const reserved = new Set([
  "admin", "api", "images", "css", "js", "files",
  ...fs.readdirSync(src).filter((f) => f.endsWith(".njk")).map((f) => f.replace(/\.njk$/, "")),
]);

module.exports = {
  layout: "page.njk",
  permalink: (data) => {
    const slug = data.page.fileSlug;
    return reserved.has(slug) ? `/${slug}-2/` : `/${slug}/`;
  },
};
