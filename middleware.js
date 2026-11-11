const CRAWLER_USER_AGENTS = [
  'facebookexternalhit',
  'whatsapp',
  'twitterbot',
  'linkedinbot',
  'telegrambot',
  'slackbot',
  'discordbot',
  'pinterest',
  'skypeuripreview',
  'applebot',
  'googlebot',
  'bingbot',
];

const API_BASE = 'https://newspaper-web-production.up.railway.app';
const TENANT_SLUG = 'digontonews';
const SITE_NAME = 'দিগন্ত নিউজ';
const DEFAULT_IMAGE = 'https://digontonews.com/assets/diganta-logo-transparent.png';

export function isCrawler(userAgent = '') {
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot));
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildArticleHtml({ title, description, image, canonicalUrl }) {
  return `<!doctype html>
<html lang="bn">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)} | ${SITE_NAME}</title>
  <meta name="description" content="${escapeHtml(description)}"/>
  <meta property="og:site_name" content="${SITE_NAME}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:title" content="${escapeHtml(title)}"/>
  <meta property="og:description" content="${escapeHtml(description)}"/>
  <meta property="og:url" content="${canonicalUrl}"/>
  <meta property="og:image" content="${escapeHtml(image)}"/>
  <meta property="og:image:secure_url" content="${escapeHtml(image)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="650"/>
  <meta property="og:image:type" content="image/jpeg"/>
  <meta property="og:image:alt" content="${escapeHtml(title)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escapeHtml(title)}"/>
  <meta name="twitter:description" content="${escapeHtml(description)}"/>
  <meta name="twitter:image" content="${escapeHtml(image)}"/>
  <meta name="twitter:image:alt" content="${escapeHtml(title)}"/>
  <link rel="canonical" href="${canonicalUrl}"/>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" width="1200" height="650"/>
</body>
</html>`;
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/article\/([^/]+)/);
  if (!match) return;

  const userAgent = request.headers.get('user-agent') || '';
  if (!isCrawler(userAgent)) {
    return;
  }

  const rawSlug = match[1];
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    slug = rawSlug;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/news/articles/${encodeURIComponent(slug)}/`,
      {
        headers: {
          'X-Tenant-Slug': TENANT_SLUG,
          'User-Agent': 'Mozilla/5.0 (DigantoNews-MetaBot)',
        },
      }
    );

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const title = data.title || SITE_NAME;
    let description = data.ai_summary || '';
    if (!description && data.content) {
      description = String(data.content)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
    }
    if (!description) description = title;

    const image = data.featured_image_url || DEFAULT_IMAGE;
    const canonicalUrl = `https://digontonews.com/article/${encodeURIComponent(slug)}`;
    const html = buildArticleHtml({ title, description, image, canonicalUrl });

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch {
    return;
  }
}

export const config = {
  matcher: ['/article/:slug*'],
};
