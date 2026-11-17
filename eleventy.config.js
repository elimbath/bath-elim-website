const yaml = require("js-yaml");
const markdownIt = require("markdown-it");
const fs = require("fs");
const path = require("path");

// Shared with the CMS preview (src/admin/preview.js has the same logic).
function menuActive(item, url, nav) {
  const norm = (u) => (u || "").replace(/\/+$/, "") || "/";
  const here = norm(url);
  const urls = [item.url, ...((item.children || []).map((c) => c.url))].filter(Boolean);
  if (urls.some((u) => norm(u) === here)) return true;
  // pages that aren't in the menu (e.g. /hireterms) can name their menu item with `nav:`
  return !!nav && (item.label || "").toLowerCase().replace(/\s+/g, "-") === nav;
}

const md = markdownIt({ html: true, breaks: false, linkify: true, typographer: false });

module.exports = function (eleventyConfig) {
  // Page content lives in src/_data/*.yml (edited through the CMS at /admin)
  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));

  eleventyConfig.addPassthroughCopy({
    "src/images": "images",
    "src/css": "css",
    "src/js": "js",
    "src/files": "files",
    "src/admin": "admin",
    "src/_redirects": "_redirects",
    // browser builds used by the CMS live preview (same versions as the real build)
    "node_modules/nunjucks/browser/nunjucks.min.js": "admin/vendor/nunjucks.min.js",
    "node_modules/markdown-it/dist/markdown-it.min.js": "admin/vendor/markdown-it.min.js",
  });

  // After each build, bundle the page templates + current content for the CMS live preview,
  // so the preview uses exactly the same templates as the real site.
  eleventyConfig.on("eleventy.after", ({ dir }) => {
    const out = { templates: {}, front: {}, data: {} };
    const add = (file, name) => {
      const raw = fs.readFileSync(file, "utf8");
      const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
      out.templates[name] = m ? raw.slice(m[0].length) : raw;
      out.front[name] = m ? yaml.load(m[1]) : {};
    };
    for (const f of fs.readdirSync("src")) if (f.endsWith(".njk")) add(path.join("src", f), f);
    for (const f of fs.readdirSync("src/_includes")) if (f.endsWith(".njk")) add(path.join("src/_includes", f), f);
    for (const f of fs.readdirSync("src/_includes/sections")) if (f.endsWith(".njk")) add(path.join("src/_includes/sections", f), "sections/" + f);
    for (const f of fs.readdirSync("src/_data")) {
      if (/\.ya?ml$/.test(f)) out.data[f.replace(/\.ya?ml$/, "")] = yaml.load(fs.readFileSync(path.join("src/_data", f), "utf8"));
    }
    fs.mkdirSync(path.join(dir.output, "admin"), { recursive: true });
    fs.writeFileSync(path.join(dir.output, "admin", "preview-templates.json"), JSON.stringify(out));
  });

  // Pages created in the CMS are Markdown; never run editors' text as template code.
  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addFilter("md", (s) => md.render(s || ""));
  eleventyConfig.addFilter("menuActive", menuActive);
  eleventyConfig.addFilter("mdInline", (s) => md.renderInline(s || ""));

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
};
