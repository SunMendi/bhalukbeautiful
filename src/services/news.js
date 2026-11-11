const env = import.meta.env || {};
export const API_BASE = (env.VITE_API_BASE_URL?.trim() || 'https://newspaper-web-production.up.railway.app').replace(/\/+$/, '');
export const TENANT_SLUG = env.VITE_TENANT_SLUG?.trim() || 'digontonews';

async function request(path, signal) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {'X-Tenant-Slug': TENANT_SLUG},
    signal,
  });
  if (!response.ok) {
    const error = new Error(`News API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function publicationDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

export function formatAuthor(author) {
  if (!author) return 'নিজস্ব প্রতিবেদক';
  if (typeof author === 'string') {
    const trimmed = author.trim();
    return trimmed || 'নিজস্ব প্রতিবেদক';
  }
  const fullName = [author.first_name, author.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (author.email) {
    const local = author.email.split('@')[0].trim();
    if (local) return local;
  }
  return 'নিজস্ব প্রতিবেদক';
}

function articleFromApi(article) {
  const publishedAt = article.published_at || article.created_at;
  let content = article.content || '';
  if (typeof DOMParser !== 'undefined' && /<[^>]+>/.test(content)) {
    const doc = new DOMParser().parseFromString(content.replace(/<\/(p|div|h[1-6])>|<br\s*\/?\s*>/gi, '\n'), 'text/html');
    doc.querySelectorAll('script,style').forEach(node => node.remove());
    content = doc.body.textContent || '';
  }
  const isJatiyo = article.category?.name === 'জাতীয়' || article.category?.name === 'জাতীয়' || article.category?.slug === 'national';
  const categoryName = isJatiyo ? 'সারাদেশ' : (article.category?.name || 'অনলাইন');
  const categorySlug = isJatiyo ? 'country' : article.category?.slug;
  const date = publicationDate(publishedAt) ? new Date(publishedAt).toLocaleDateString('bn-BD', {timeZone: 'Asia/Dhaka', dateStyle: 'long'}) : '';
  const author = formatAuthor(article.author);
  return {
    id: article.slug,
    title: article.title,
    author,
    image: article.featured_image_url || '',
    summary: article.ai_summary || '',
    aiSummary: article.ai_summary || '',
    audioUrl: article.audio_file_url || '',
    category: categoryName,
    categorySlug,
    publishedAt,
    meta: `${categoryName} | ${date}`,
    body: content.split(/\n+/).map(part => part.trim()).filter(Boolean),
    videoUrl: article.video_url || '',
  };
}

export async function loadNewsDataset(signal) {
  const [categories, articles] = await Promise.all([
    request('/api/news/categories/', signal),
    request('/api/news/articles/', signal),
  ]);
  const dataset = {articles: {}, categories: {}, categorySlugs: {}, homeIds: [], papers: []};
  const list = categories.filter(c => c.name !== 'জাতীয়' && c.name !== 'জাতীয়' && c.slug !== 'national');
  const saradesh = list.find(c => c.name === 'সারাদেশ' || c.slug === 'country');
  const ordered = saradesh ? [saradesh, ...list.filter(c => c !== saradesh)] : list;
  for (const category of ordered) {
    dataset.categories[category.name] = [];
    dataset.categorySlugs[category.name] = category.slug;
  }
  for (const article of articles) {
    const story = articleFromApi(article);
    dataset.articles[story.id] = story;
    dataset.homeIds.push(story.id);
    (dataset.categories[story.category] ||= []).push(story.id);
    dataset.categorySlugs[story.category] = story.categorySlug;
  }
  return dataset;
}

export async function loadArticle(slug, signal) {
  return articleFromApi(await request(`/api/news/articles/${encodeURIComponent(slug)}/`, signal));
}
