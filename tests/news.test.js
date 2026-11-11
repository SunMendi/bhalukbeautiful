import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {API_BASE, TENANT_SLUG, loadNewsDataset, loadArticle, publicationDate, formatAuthor} from '../src/services/news.js';

const originalFetch = globalThis.fetch;
afterEach(() => {globalThis.fetch = originalFetch;});
const category = {name: 'খেলা', slug: 'sports'};
const article = {
  id: 42, slug: 'বাংলা-সংবাদ', title: 'আজকের খবর', category,
  featured_image_url: 'https://example.com/news.jpg',
  published_at: '2026-11-06T19:00:00Z',
};

test('loads Django lists with the portal header and maps categories and slugs', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({url, options});
    return {ok: true, json: async () => url.includes('/categories/') ? [category] : [article]};
  };
  const data = await loadNewsDataset();
  assert.equal(TENANT_SLUG, 'digontonews');
  assert.deepEqual(data.homeIds, [article.slug]);
  assert.deepEqual(data.categories['খেলা'], [article.slug]);
  assert.equal(data.categorySlugs['খেলা'], 'sports');
  assert.equal(data.articles[article.slug].image, article.featured_image_url);
  assert.deepEqual(data.papers, []);
  for (const call of calls) {
    assert.equal(call.options.headers['X-Tenant-Slug'], TENANT_SLUG);
    assert.ok(call.url.startsWith(API_BASE+'/api/news/'));
  }
});

test('empty portal returns empty collections without sample stories', async () => {
  globalThis.fetch = async () => ({ok: true, json: async () => []});
  assert.deepEqual(await loadNewsDataset(), {articles: {}, categories: {}, categorySlugs: {}, homeIds: [], papers: []});
});

test('article details use the encoded slug and supply the full body', async () => {
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `${API_BASE}/api/news/articles/${encodeURIComponent(article.slug)}/`);
    assert.equal(options.signal, controller.signal);
    assert.equal(options.headers['X-Tenant-Slug'], TENANT_SLUG);
    return {ok: true, json: async () => ({...article, content: 'প্রথম অংশ\n\nদ্বিতীয় অংশ', ai_summary: 'সারাংশ'})};
  };
  const result = await loadArticle(article.slug, controller.signal);
  assert.deepEqual(result.body, ['প্রথম অংশ', 'দ্বিতীয় অংশ']);
  assert.equal(result.summary, 'সারাংশ');
});

test('API errors propagate without replacing real news with fixtures', async () => {
  globalThis.fetch = async () => ({ok: false, status: 503});
  await assert.rejects(loadNewsDataset(), {status: 503});
  globalThis.fetch = async () => ({ok: false, status: 404});
  await assert.rejects(loadArticle('missing'), {status: 404});
});

test('publication dates use Bangladesh time across midnight', () => {
  assert.equal(publicationDate(article.published_at), '2026-11-07');
  assert.equal(publicationDate(null), '');
  assert.equal(publicationDate('invalid'), '');
});

test('formats author name from user object or falls back to protibedok', () => {
  assert.equal(formatAuthor({first_name: 'মেহেদী', last_name: 'হাসান'}), 'মেহেদী হাসান');
  assert.equal(formatAuthor({first_name: 'মেহেদী', last_name: ''}), 'মেহেদী');
  assert.equal(formatAuthor({email: 'reporter@example.com'}), 'reporter');
  assert.equal(formatAuthor('কামাল হোসেন'), 'কামাল হোসেন');
  assert.equal(formatAuthor(null), 'নিজস্ব প্রতিবেদক');
  assert.equal(formatAuthor({}), 'নিজস্ব প্রতিবেদক');
});
