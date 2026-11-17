# Bath Elim Church website

The church website (previously on Wix at https://www.elimbath.org), rebuilt as a free static site:

- **Eleventy** turns page templates + content files into plain HTML.
- **Decap CMS** at `/admin` lets church editors change text, photos, team members, videos, notices etc. in a friendly editor. Each change is saved to GitHub (so there is a full history and nothing can be lost) and Cloudflare republishes the site about a minute later.
- **Cloudflare Pages** hosts it for free, and runs two tiny functions: the CMS login, and the contact/hire forms (emailed via Resend).

## Where things are

```
src/_data/*.yml      ← all page content, incl. the menu (menu.yml) — this is what the CMS edits
src/pages/*.md       ← extra pages created in the CMS ("New pages")
src/*.njk            ← page layouts (one per built-in page)
src/_includes/       ← shared layout, header/menu, footer, and page.njk (layout for new pages)
src/images/          ← photos (CMS uploads land here too)
src/css, src/js, src/files (safeguarding PDF), src/_redirects
src/admin/           ← the CMS: index.html, config.yml (which fields editors see), preview.js (live preview)
functions/api/       ← Cloudflare functions: auth.js + callback.js (CMS login), [form].js (forms)
eleventy.config.js   ← build settings
_site/               ← build output (generated, not committed)
```

## Working on it locally

```bash
npm install
npm run dev          # site at http://localhost:8080, rebuilds on every change
npm run cms          # (second terminal) lets http://localhost:8080/admin edit local files, no login needed
```

## Going live (one-time setup)

1. **GitHub** – create a repository (e.g. `bath-elim-website`) and push this folder to its `main` branch.
   Put the repo name in `src/admin/config.yml` → `backend.repo`.
2. **Cloudflare Pages** – Workers & Pages → Create → Pages → *Connect to Git* → pick the repo.
   - Build command: `npm run build`
   - Build output directory: `_site`
3. **CMS login (GitHub OAuth app)** – GitHub → Settings → Developer settings → OAuth Apps → New:
   - Homepage URL: `https://<your-site>` (the `*.pages.dev` address, later `https://www.elimbath.org`)
   - Authorization callback URL: `https://<your-site>/api/callback`
   - In Cloudflare Pages → Settings → Variables and secrets, add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (secret), then redeploy.
4. **Forms** – create a free [Resend](https://resend.com) account, verify the `elimbath.org` domain, then add
   `RESEND_API_KEY` (secret), `FORM_TO_EMAIL` (who receives submissions) and
   `FORM_FROM_EMAIL` (e.g. `Bath Elim Website <website@elimbath.org>`). Until then the forms show
   "Sorry, the form could not be sent".
5. **Domain** – in Cloudflare Pages → Custom domains, add `www.elimbath.org` (and `elimbath.org`),
   then point the domain's DNS at Cloudflare. Update the OAuth app URLs to the real domain.

## Adding an editor

Editors need a (free) GitHub account. Add them to the repository as a collaborator with **Write** access
(repo → Settings → Collaborators). They then go to `https://www.elimbath.org/admin`, click **Login with GitHub**, and edit.

## What editors can do

- **Edit any page**: every built-in page has its own form, with a **live preview** beside it that shows
  the real page design updating as you type (click the eye icon to hide/show it).
- **Create new pages** (*New pages → New page*): title, optional top photo, introduction, and free-form
  content with headings, lists, links and pictures. The address comes from the title
  (`Youth Group` → `/youth-group`). If it clashes with an existing page it gets `-2` added.
- **Edit the menu** (*Site settings → Menu*): add, rename, reorder or remove items and drop-downs.
  New pages don't appear in the menu until they're added here.
- **Footer details** (*Site settings → Footer & contact details*).

The live preview renders the same templates as the real site (bundled at build time into
`/admin/preview-templates.json`), so it can't drift out of step with the design.

## Weekly tasks for editors

- **Home → Live stream**: update the button label (date) and YouTube link.
- **Home → Notices & event posters**: add/hide event banners.
- **Watch again**: add the newest video at the top.

## Notes

- Fonts are free look-alikes of the Wix fonts (Montserrat for Lulo Clean, etc.).
- The old Wix URL `/copy-of-watch-again` redirects to `/watch-again`.
- Built-in pages (Home, Give, …) can be edited but not deleted from the CMS; pages made under *New pages* can be deleted.
