// Real backend API client for Diganta News.
// Configure with VITE_API_BASE_URL (defaults to the production backend).
// See docs/ADMIN_API_MAP.md for the page and endpoint map.

export const API_BASE = (
  (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.trim() ||
  "https://newspaper-web-production.up.railway.app"
).replace(/\/+$/, "");

export const TENANT_SLUG = (
  (import.meta.env?.VITE_TENANT_SLUG as string | undefined)?.trim() ||
  "digontonews"
);

const TOKEN_KEY = "dgn_access_token";
const REFRESH_KEY = "dgn_refresh_token";
const USER_KEY = "dgn_admin_session";

export function getAccessToken(): string | null {
  try {
    return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}
export function setTokens(access: string, refresh?: string) {
  try {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    /* noop */
  }
}
export function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* noop */
  }
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type ApiOptions = RequestInit & { auth?: boolean; isForm?: boolean };

let tokenRefreshPromise: Promise<string> | null = null;

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/accounts/token/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Slug": TENANT_SLUG,
    },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  const text = await response.text();
  const data = text ? safeJson(text) : null;
  if (!response.ok || !data || typeof data !== "object" || !("access" in data)) {
    throw new ApiError("Session expired", response.status || 401, data);
  }

  const tokens = data as { access: string; refresh?: string };
  setTokens(tokens.access, tokens.refresh);
  return tokens.access;
}

export async function apiFetch<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { auth = false, isForm = false, headers, ...rest } = opts;
  const h: Record<string, string> = { ...(headers as Record<string, string>) };
  h["X-Tenant-Slug"] = TENANT_SLUG;
  if (!isForm) h["Content-Type"] = "application/json";
  if (auth) {
    const t = getAccessToken();
    if (t) h["Authorization"] = `Bearer ${t}`;
  }
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...rest, headers: h });
  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (res.status === 401 && auth && !path.includes("/token/refresh/")) {
    const refreshToken = typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
    if (refreshToken) {
      if (!tokenRefreshPromise) {
        tokenRefreshPromise = refreshAccessToken(refreshToken);
      }

      let newToken: string;
      try {
        newToken = await tokenRefreshPromise;
      } catch (refreshError) {
        clearTokens();
        if (typeof window !== "undefined") window.location.href = "/admin/login";
        throw refreshError;
      } finally {
        tokenRefreshPromise = null;
      }

      h["Authorization"] = `Bearer ${newToken}`;
      const retryRes = await fetch(url, { ...rest, headers: h });
      const retryText = await retryRes.text();
      const retryData = retryText ? safeJson(retryText) : null;
      if (!retryRes.ok) {
        throw new ApiError(
          retryRes.statusText || `HTTP ${retryRes.status}`,
          retryRes.status,
          retryData,
        );
      }
      return retryData as T;
    } else {
      clearTokens();
      if (typeof window !== "undefined") window.location.href = "/admin/login";
    }
  }

  if (!res.ok) {
    throw new ApiError(
      extractErrorMessage(data, res.statusText || `HTTP ${res.status}`),
      res.status,
      data,
    );
  }
  return data as T;
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === "string" && obj.detail) return obj.detail;
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.error === "string" && obj.error) return obj.error;

    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
        return `${key}: ${val[0]}`;
      }
      if (typeof val === "string") return val;
    }
  }
  return fallback;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

// ---------- Types ----------
export type Role = "OWNER" | "EIC" | "EDITOR" | "REPORTER" | "READER" | "ADMIN" | "SUPERADMIN";
export type User = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: Role;
  area?: string | null;
  is_active?: boolean;
  is_pending_approval?: boolean;
  created_at?: string;
};
export type AuthResponse = { access: string; refresh: string; user: User };

export function isEditorRole(role?: string): boolean {
  if (!role) return false;
  const r = role.toUpperCase();
  return r === "OWNER" || r === "ADMIN" || r === "SUPERADMIN" || r === "EIC" || r === "EDITOR";
}

export function isOwnerRole(role?: string): boolean {
  if (!role) return false;
  const r = role.toUpperCase();
  return r === "OWNER" || r === "ADMIN" || r === "SUPERADMIN" || r === "EIC";
}

export type Category = {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type ArticleStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED";
export type ArticleAuthorLabel = "REPORTER" | "EDITOR";
export type ApiArticle = {
  id: number;
  title: string;
  slug: string;
  content?: string;
  category: Category;
  author: User;
  author_label?: ArticleAuthorLabel | string;
  status: ArticleStatus;
  rejection_feedback?: string;
  districts?: { id: number; name: string; slug: string }[];
  sources?: { name: string; url?: string }[];
  featured_image_url?: string | null;
  featured_image_public_id?: string;
  ai_summary?: string;
  audio_file_url?: string | null;
  audio_status?: "PENDING" | "RUNNING" | "READY" | "FAILED";
  audio_is_delayed?: boolean;
  share_card_url?: string | null;
  facebook_posted?: boolean;
  facebook_post_url?: string | null;
  is_breaking: boolean;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdSlot = "BANNER_TOP" | "SIDEBAR" | "IN_ARTICLE";
export type Ad = {
  id: number;
  title: string;
  slot: AdSlot;
  image_url: string;
  image_public_id?: string;
  target_url: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  impressions?: number;
  clicks?: number;
  created_at?: string;
  updated_at?: string;
};

// ---------- Auth ----------
export const authApi = {
  signupStaff: (email: string, password: string, role: "EDITOR" | "REPORTER", signal?: AbortSignal) =>
    apiFetch<{ message: string }>("/api/accounts/staff/signup/", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
      signal,
    }),
  signup: (email: string, password: string, signal?: AbortSignal) =>
    apiFetch<{ message: string }>("/api/accounts/signup/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      signal,
    }),
  verifyOtp: (email: string, otp: string) =>
    apiFetch<AuthResponse>("/api/accounts/verify-otp/", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),
  login: (email: string, password: string) =>
    apiFetch<AuthResponse>("/api/accounts/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
};

// ---------- Users (Portal Admin / Owner) ----------
export type CreatePortalUserData = {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role: "EDITOR" | "REPORTER";
  area?: string;
};

export const usersApi = {
  pending: () => apiFetch<User[]>("/api/accounts/users/pending/", { auth: true }),
  approve: (id: number) =>
    apiFetch<User>(`/api/accounts/users/${id}/approve/`, { method: "POST", auth: true }),
  list: () => apiFetch<User[]>("/api/accounts/users/", { auth: true }),
  create: (data: CreatePortalUserData) =>
    apiFetch<User>("/api/accounts/users/", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  updateRole: (id: number, role: Role) =>
    apiFetch<User>(`/api/accounts/users/${id}/role/`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
      auth: true,
    }),
};

// ---------- Categories ----------
export const categoriesApi = {
  list: () => apiFetch<Category[]>("/api/news/categories/"),
  create: (data: { name: string; slug?: string }) =>
    apiFetch<Category>("/api/news/categories/", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  get: (slug: string) => apiFetch<Category>(`/api/news/categories/${encodeURIComponent(slug)}/`),
  update: (slug: string, data: Partial<{ name: string; slug: string }>) =>
    apiFetch<Category>(`/api/news/categories/${encodeURIComponent(slug)}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: true,
    }),
  remove: (slug: string) =>
    apiFetch<null>(`/api/news/categories/${encodeURIComponent(slug)}/`, {
      method: "DELETE",
      auth: true,
    }),
};

// ---------- Articles ----------
export type ArticleListParams = {
  category?: string;
  district?: string;
  search?: string;
  is_breaking?: boolean;
};
function qs(params: Record<string, string | number | boolean | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const articlesApi = {
  list: (params: ArticleListParams = {}) =>
    apiFetch<ApiArticle[]>(`/api/news/articles/${qs(params)}`),
  getPublic: (slug: string) =>
    apiFetch<ApiArticle>(`/api/news/articles/${encodeURIComponent(slug)}/`),
  get: (slug: string) =>
    apiFetch<ApiArticle>(`/api/news/articles/${encodeURIComponent(slug)}/`, { auth: true }),
  create: (data: {
    title: string;
    content: string;
    category_id: number;
    is_breaking?: boolean;
    slug?: string;
    ai_summary?: string;
    audio_file_url?: string;
  }) =>
    apiFetch<ApiArticle>("/api/news/articles/", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  createWithImage: (form: FormData) =>
    apiFetch<ApiArticle>("/api/news/articles/", {
      method: "POST",
      body: form,
      auth: true,
      isForm: true,
    }),
  update: (slug: string, data: Partial<ApiArticle> & { category_id?: number }) =>
    apiFetch<ApiArticle>(`/api/news/articles/${encodeURIComponent(slug)}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: true,
    }),
  updateWithImage: (slug: string, form: FormData) =>
    apiFetch<ApiArticle>(`/api/news/articles/${encodeURIComponent(slug)}/`, {
      method: "PATCH",
      body: form,
      auth: true,
      isForm: true,
    }),
  remove: (slug: string) =>
    apiFetch<null>(`/api/news/articles/${encodeURIComponent(slug)}/`, {
      method: "DELETE",
      auth: true,
    }),
  submit: (slug: string) =>
    apiFetch<ApiArticle>(`/api/news/articles/${encodeURIComponent(slug)}/submit/`, {
      method: "POST",
      auth: true,
    }),
  approve: (slug: string) =>
    apiFetch<ApiArticle>(`/api/news/articles/${encodeURIComponent(slug)}/approve/`, {
      method: "POST",
      auth: true,
    }),
  reject: (slug: string, feedback: string) =>
    apiFetch<ApiArticle>(`/api/news/articles/${encodeURIComponent(slug)}/reject/`, {
      method: "POST",
      body: JSON.stringify({ feedback }),
      auth: true,
    }),
  recall: (slug: string) =>
    apiFetch<ApiArticle>(`/api/news/articles/${encodeURIComponent(slug)}/recall/`, {
      method: "POST",
      auth: true,
    }),
  trackView: (slug: string, referrer_url = "") =>
    apiFetch(`/api/news/articles/${encodeURIComponent(slug)}/view/`, {
      method: "POST",
      body: JSON.stringify({ referrer_url }),
    }).catch(() => null),
  editorList: (status?: ArticleStatus) =>
    apiFetch<ApiArticle[]>(`/api/news/editor/articles/${status ? `?status=${status}` : ""}`, {
      auth: true,
    }),
  importRss: (data: { limit?: number; status?: "DRAFT" | "PUBLISHED" } = {}) =>
    apiFetch<RssImportJob>("/api/news/articles/import-rss/", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
      signal: AbortSignal.timeout(15000),
    }),
  importRssStatus: (id: string) =>
    apiFetch<RssImportJob>(`/api/news/articles/import-rss/${encodeURIComponent(id)}/`, {
      auth: true,
      signal: AbortSignal.timeout(15000),
    }),
};

export type RssImportJob = {
  id: string;
  state: "queued" | "running" | "succeeded" | "failed";
  error: string;
  details: {
    feeds_succeeded: number;
    feeds_failed: { name: string; error: string }[];
    items_created: number;
    candidate_stories: number;
    new_stories: number;
    already_imported_stories: number;
    eligible_stories: number;
    requested_articles: number;
    articles_missing: number;
    generation_failures: { title: string; error: string }[];
    articles_created: number;
    article_ids: number[];
  } | null;
};

// ---------- Ads ----------
export const adsApi = {
  adminList: (slot?: AdSlot) =>
    apiFetch<Ad[]>(`/api/news/ads/${slot ? `?slot=${slot}` : ""}`, { auth: true }),
  list: (slot?: AdSlot) => apiFetch<Ad[]>(`/api/news/ads/${slot ? `?slot=${slot}` : ""}`),
  get: (id: number) => apiFetch<Ad>(`/api/news/ads/${id}/`),
  create: (data: Partial<Ad>) =>
    apiFetch<Ad>("/api/news/ads/", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  createWithImage: (form: FormData) =>
    apiFetch<Ad>("/api/news/ads/", {
      method: "POST",
      body: form,
      auth: true,
      isForm: true,
    }),
  update: (id: number, data: Partial<Ad>) =>
    apiFetch<Ad>(`/api/news/ads/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: true,
    }),
  updateWithImage: (id: number, form: FormData) =>
    apiFetch<Ad>(`/api/news/ads/${id}/`, {
      method: "PATCH",
      body: form,
      auth: true,
      isForm: true,
    }),
  remove: (id: number) => apiFetch<null>(`/api/news/ads/${id}/`, { method: "DELETE", auth: true }),
  impression: (id: number) =>
    apiFetch(`/api/news/ads/${id}/impression/`, { method: "POST" }).catch(() => null),
  click: (id: number) =>
    apiFetch<{ id: number; clicks: number; target_url: string }>(`/api/news/ads/${id}/click/`, {
      method: "POST",
    }).catch(() => null),
};

// ---------- Analytics ----------
export type DateRange = { start_date?: string; end_date?: string };
export type AnalyticsOverview = {
  total_views: number;
  published_articles: number;
  pending_articles: number;
  active_ads: number;
  views_by_day: { day: string; count: number }[];
};
export type TopArticle = {
  article_id: number;
  article__title: string;
  article__slug: string;
  views: number;
};
export type ReporterPerf = {
  article__author_id: number;
  article__author__email: string;
  views: number;
  articles: number;
};
export type ReferrerRow = { referrer: string; views: number };
export type CategoryRow = {
  article__category_id: number;
  article__category__name: string;
  article__category__slug: string;
  views: number;
  articles: number;
};

export const analyticsApi = {
  overview: (r: DateRange = {}) =>
    apiFetch<AnalyticsOverview>(`/api/news/analytics/overview/${qs(r)}`, {
      auth: true,
    }),
  articles: (r: DateRange = {}) =>
    apiFetch<TopArticle[]>(`/api/news/analytics/articles/${qs(r)}`, {
      auth: true,
    }),
  reporters: (r: DateRange = {}) =>
    apiFetch<ReporterPerf[]>(`/api/news/analytics/reporters/${qs(r)}`, {
      auth: true,
    }),
  referrers: (r: DateRange = {}) =>
    apiFetch<ReferrerRow[]>(`/api/news/analytics/referrers/${qs(r)}`, {
      auth: true,
    }),
  categories: (r: DateRange = {}) =>
    apiFetch<CategoryRow[]>(`/api/news/analytics/categories/${qs(r)}`, {
      auth: true,
    }),
};

// ---------- Facebook Meta Integration ----------
export type FacebookPage = {
  id: number;
  page_id: string;
  page_name: string;
  page_category?: string;
  is_active: boolean;
  auto_post: boolean;
  created_at: string;
  updated_at: string;
};

export type FacebookPublishResult = {
  page_id: string;
  status: "SUCCESS" | "FAILED";
  post_id?: string;
  error?: string;
  comment_status?: "UNKNOWN" | "PENDING" | "SUCCESS" | "FAILED";
  comment_id?: string;
  comment_error?: string;
};

export type FacebookPublishResponse = {
  results: FacebookPublishResult[];
  share_card_url?: string;
  photocard_url?: string;
  detail?: string;
};

export const facebookApi = {
  getAuthUrl: () =>
    apiFetch<{ auth_url: string }>("/api/news/facebook/connect/", {
      auth: true,
    }),
  getPages: () =>
    apiFetch<FacebookPage[]>("/api/news/facebook/pages/", {
      auth: true,
    }),
  connectWithToken: (data: { access_token: string; page_id?: string }) =>
    apiFetch<FacebookPage[]>("/api/news/facebook/pages/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      auth: true,
    }),
  updatePage: (id: number, data: { is_active?: boolean; auto_post?: boolean }) =>
    apiFetch<FacebookPage>(`/api/news/facebook/pages/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      auth: true,
    }),
  disconnectPage: (id: number) =>
    apiFetch<{ detail?: string }>(`/api/news/facebook/pages/${id}/`, {
      method: "DELETE",
      auth: true,
    }),
  generatePhotocard: (slug: string) =>
    apiFetch<FacebookPublishResponse>(`/api/news/articles/${slug}/photocard/`, {
      method: "POST",
      auth: true,
    }),
  publishToFacebook: (slug: string, pageId?: number) =>
    apiFetch<FacebookPublishResponse>(`/api/news/articles/${slug}/facebook-publish/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pageId ? { page_id: pageId } : {}),
      auth: true,
    }),
};
