# Digonto News

[Live website](https://digontonews.vercel.app)

React + Vite + Tailwind CSS Bengali news frontend, built from direct Playwright inspection of mzamin.com. Uses the supplied দিগন্ত নিউজ brand and a transparent logo cutout.

![Diganta News desktop preview](docs/verification/transparent-logo-desktop.png)

## Run

```sh
npm install
npm run dev
```

`npm run build` creates `dist/`. Configure your production host to serve `index.html` for frontend routes.

## Pages

- `/`: newspaper homepage
- `/category/:slug`: all 21 reference categories (Bengali names with spaces replaced by hyphens)
- `/article/:id`: article detail, text sizing, copying, printing, related news
- `/newstoday`: today's newspaper sections
- `/print`: print edition with date selector and full-page viewer (arrow keys and Escape supported)
- `/archive-calendar`: month navigation and date selection
- `/archive?date=YYYY-MM-DD`: archive listing
- `/search?q=...`: news search
- `/videos`: video page
- `/about`, `/contact`, `/privacy`: branded informational placeholders

## Admin console

Open `/admin/login` to sign in. The console includes articles, drafts, review, categories, users, ads, Facebook, and five analytics pages. It also includes signup and OTP pages. See [the page and API map](docs/ADMIN_API_MAP.md) for routes, permissions, and checks.

## Backend integration

The adapter in `src/services/news.js` calls the shared Django API. It defaults to:

```env
VITE_API_BASE_URL=https://newspaper-web-production.up.railway.app
VITE_TENANT_SLUG=digontonews
```

Copy `.env.example` to `.env` to change these values. Vite reads them at build time. Set the same values in Vercel before building there.

This local project serves Diganta News at `digontonews.com`. The folder name does not identify the backend portal.

Every request sends `X-Tenant-Slug: digontonews`. The slug must match an active portal record in Django admin (`/admin/`, Tenants). The live backend has an active Diganta News record with slug `digontonews`, domain `digontonews.com`, and ID `3`. Keep the slug consistent: the backend falls back to another portal when it does not recognize a slug.

The frontend uses these routes:

- `GET /api/news/categories/`: names and slugs for menus and sections.
- `GET /api/news/articles/`: published stories for the homepage, categories, search, and archive.
- `GET /api/news/articles/:slug/`: full article text, loaded when a reader opens a story.

Article links use backend slugs. Dates use Bangladesh time. Search and archive filters use the loaded published stories. Requests that fail show a retry message. Empty portals show an empty news page. The app does not use reference stories as fallback data.

The API has no print-edition route. The print page shows an empty state. The video page shows published article video URLs. Contact and editorial information still need your real details.

Check the frontend origin in backend `CORS_ALLOWED_ORIGINS` if your server restricts browser access. The backend already allows the `X-Tenant-Slug` request header.

Run `npm test` for API adapter checks, `npm run typecheck` for TypeScript checks, and `npm run build` for the production build.

Reference screenshots are in `docs/reference/`. Verification screenshots are in `docs/verification/`.

## Brand colors

Shared CSS tokens in `src/style.css` use the new logo's sampled cyan `#27AAE2`, ink `#111111`, and gold `#FCB040`. White surfaces and neutral metadata keep the news readable. Cyan fills use ink text; a darker cyan `#0875A1` keeps small links legible on white. Gold marks the current calendar date. Dark mode uses lighter cyan accents.

`public/assets/diganta-logo-transparent.png` is the active RGBA logo cutout with a transparent background. Header, menu, footer, and favicon use it. The SVG file wraps that PNG for compatibility; it is not a vector tracing. The original supplied image remains in `diganta-logo-original.png`. Dark mode recolors dark lettering with an SVG display filter while retaining the colored book and sun, without a backing rectangle.

## Runtime services

The frontend downloads Tiro Bangla from Google Fonts. The API supplies news image and video URLs. Old reference fixtures remain stored locally for design review. The project is an independent implementation inspired by mzamin.com and is not affiliated with that publication.

## Vercel deployment

`vercel.json` configures the Vite production build and SPA fallback for direct article/category URLs. Run `vercel --prod` with an authenticated Vercel CLI. Local Vercel credentials and project metadata remain untracked. Configure `VITE_API_BASE_URL` in the Vercel project when connecting a backend.
