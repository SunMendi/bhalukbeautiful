import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import middleware, { isCrawler, escapeHtml, buildArticleHtml } from '../middleware.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('isCrawler identifies social media bots and ignores browsers', () => {
  assert.equal(isCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'), false);
  assert.equal(isCrawler('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148 Safari/604.1'), false);
  assert.equal(isCrawler('WhatsApp/2.21.12.21 A'), true);
  assert.equal(isCrawler('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'), true);
  assert.equal(isCrawler('Twitterbot/1.0'), true);
  assert.equal(isCrawler('TelegramBot (like TwitterBot)'), true);
  assert.equal(isCrawler('LinkedInBot/1.0'), true);
});

test('escapeHtml escapes dangerous HTML characters', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("Tom & Jerry's"), 'Tom &amp; Jerry&#039;s');
});

test('buildArticleHtml renders 1200x650 OpenGraph tags and Twitter card', () => {
  const html = buildArticleHtml({
    title: 'পরীক্ষামূলক সংবাদ শিরোনাম',
    description: 'সংবাদের সারসংক্ষেপ',
    image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    canonicalUrl: 'https://digontonews.com/article/test-slug',
  });

  assert.ok(html.includes('<meta property="og:title" content="পরীক্ষামূলক সংবাদ শিরোনাম"/>'));
  assert.ok(html.includes('<meta property="og:image" content="https://res.cloudinary.com/demo/image/upload/sample.jpg"/>'));
  assert.ok(html.includes('<meta property="og:image:width" content="1200"/>'));
  assert.ok(html.includes('<meta property="og:image:height" content="650"/>'));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image"/>'));
  assert.ok(html.includes('<link rel="canonical" href="https://digontonews.com/article/test-slug"/>'));
});

test('middleware skips non-crawler requests', async () => {
  const req = new Request('https://digontonews.com/article/test-slug', {
    headers: { 'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0' },
  });
  const res = await middleware(req);
  assert.equal(res, undefined);
});

test('middleware returns rich HTML for crawler on article route', async () => {
  globalThis.fetch = async (url, options) => {
    assert.ok(url.includes('/api/news/articles/'));
    assert.equal(options.headers['X-Tenant-Slug'], 'digontonews');
    return {
      ok: true,
      json: async () => ({
        title: 'ফেনীতে নবজাতকের বাবার মৃত্যু',
        ai_summary: 'ছাদ থেকে পড়ে রহস্যজনক মৃত্যু হয়েছে।',
        featured_image_url: 'https://res.cloudinary.com/demo/image/upload/feni.jpg',
      }),
    };
  };

  const req = new Request(
    'https://digontonews.com/article/%E0%A6%AB%E0%A7%87%E0%A6%A8%E0%A7%80%E0%A6%A4%E0%A7%87-%E0%A6%AE%E0%A7%83%E0%A6%A4%E0%A7%8D%E0%A6%AF%E0%A7%81',
    {
      headers: { 'user-agent': 'WhatsApp/2.21.12.21 A' },
    }
  );
  const res = await middleware(req);
  assert.ok(res instanceof Response);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/html'));
  const text = await res.text();
  assert.ok(text.includes('property="og:title" content="ফেনীতে নবজাতকের বাবার মৃত্যু"'));
  assert.ok(text.includes('property="og:image" content="https://res.cloudinary.com/demo/image/upload/feni.jpg"'));
  assert.ok(text.includes('property="og:image:width" content="1200"'));
  assert.ok(text.includes('property="og:image:height" content="650"'));
  assert.ok(text.includes('name="twitter:card" content="summary_large_image"'));
});
