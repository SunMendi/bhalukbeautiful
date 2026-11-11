import { Link, useNavigate, useSearch } from "@/admin/navigation";

import { useCallback, useEffect, useState } from "react";
import {
  Pencil,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  RotateCcw,
  Loader2,
  Check,
} from "lucide-react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import {
  isEditorRole,
  articlesApi,
  type ApiArticle,
  type ArticleStatus,
} from "@/lib/api-client";
import { useAdminAuth } from "@/lib/admin-auth";
import { formatBdDate, formatBdTime, formatBdDateTime } from "@/lib/date-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const STATUSES: { value: ArticleStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "সব" },
  { value: "DRAFT", label: "ড্রাফট" },
  { value: "PENDING", label: "অনুমোদনের অপেক্ষায়" },
  { value: "PUBLISHED", label: "প্রকাশিত" },
  { value: "REJECTED", label: "প্রত্যাখ্যাত" },
];

export default () => (
    <AdminLayout>
      <ArticlesPage />
    </AdminLayout>
  );

function ArticlesPage() {
  const query = useSearch();
  const status = STATUSES.find(item=>item.value===query.status)?.value || "ALL";
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const [items, setItems] = useState<ApiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSlug, setRejectSlug] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");

  const isEditor = isEditorRole(user?.role);
  const [previewArticle, setPreviewArticle] = useState<ApiArticle | null>(null);

  const fetchArticles = useCallback(
    (clearError = true) => {
      setLoading(true);
      if (clearError) setError(null);
      articlesApi
        .editorList(status === "ALL" ? undefined : status)
        .then(setItems)
        .catch((err) => setError(err instanceof Error ? err.message : "লোড ব্যর্থ"))
        .finally(() => setLoading(false));
    },
    [status],
  );

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleDelete = async (slug: string) => {
    if (!confirm("আপনি কি নিশ্চিত?")) return;
    try {
      await articlesApi.remove(slug);
      setItems((prev) => prev.filter((a) => a.slug !== slug));
      setSuccessMsg("পোস্টটি মুছে ফেলা হয়েছে");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "মুছে ফেলা ব্যর্থ হয়েছে");
    }
  };

  const handleSubmit = async (article: ApiArticle) => {
    setProcessingId(article.id);
    setError(null);
    try {
      const updated = await articlesApi.submit(article.slug);
      setItems((prev) => prev.map((a) => (a.id === article.id ? updated : a)));
      setSuccessMsg("পোস্টটি অনুমোদনের জন্য জমা দেওয়া হয়েছে");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "জমা দেওয়া ব্যর্থ হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (article: ApiArticle) => {
    setError(null);
    setSuccessMsg(null);
    setProcessingId(article.id);
    try {
      let slugToApprove = article.slug;
      if (article.status === "DRAFT" || article.status === "REJECTED") {
        const submitted = await articlesApi.submit(article.slug);
        slugToApprove = submitted.slug;
      }
      const updated = await articlesApi.approve(slugToApprove);
      setItems((prev) => prev.map((a) => (a.id === article.id ? updated : a)));
      setSuccessMsg(`✓ "${article.title}" সফলভাবে অনুমোদিত ও প্রকাশিত হয়েছে!`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "অনুমোদন ব্যর্থ হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectSlug || !rejectFeedback.trim()) return;
    const target = items.find((i) => i.slug === rejectSlug);
    if (target) setProcessingId(target.id);
    setError(null);
    try {
      let targetSlug = rejectSlug;
      if (target && (target.status === "DRAFT" || target.status === "REJECTED")) {
        const submitted = await articlesApi.submit(rejectSlug);
        targetSlug = submitted.slug;
      }
      const updated = await articlesApi.reject(targetSlug, rejectFeedback);
      setItems((prev) => prev.map((a) => (a.slug === rejectSlug ? updated : a)));
      setRejectDialogOpen(false);
      setRejectSlug(null);
      setRejectFeedback("");
      setSuccessMsg("পোস্টটি প্রত্যাখ্যান করা হয়েছে");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "প্রত্যাখ্যান ব্যর্থ হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRecall = async (article: ApiArticle) => {
    setProcessingId(article.id);
    setError(null);
    try {
      const updated = await articlesApi.recall(article.slug);
      setItems((prev) => prev.map((a) => (a.id === article.id ? updated : a)));
      setSuccessMsg("পোস্টটি ড্রাফটে ফেরত পাঠানো হয়েছে");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিকল ব্যর্থ হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (slug: string) => {
    setRejectSlug(slug);
    setRejectFeedback("");
    setRejectDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="সব পোস্ট"
        desc="আপনার সব লেখা স্ট্যাটাস অনুযায়ী দেখুন এবং অনুমোদন প্রক্রিয়া পরিচালনা করুন"
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="relative z-30 pointer-events-auto"
              onClick={() => {
                void navigate({ to: "/admin/articles/new" });
              }}
            >
              নতুন পোস্ট
            </Button>
          </div>
        }
      />

      <div className="flex gap-2 mb-4 border-b">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            to="/admin/articles"
            search={{ status: s.value }}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              status === s.value
                ? "border-red-600 text-red-600 font-medium"
                : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {successMsg && (
        <div className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 p-3 rounded mb-4 flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3">শিরোনাম</th>
              <th className="px-4 py-3">ক্যাটাগরি</th>
              <th className="px-4 py-3">স্ট্যাটাস</th>
              <th className="px-4 py-3">তারিখ ও সময়</th>
              <th className="px-4 py-3 text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  লোড হচ্ছে…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  কোনো পোস্ট পাওয়া যায়নি
                </td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setPreviewArticle(a)}
                      className="font-medium text-left hover:text-red-600 hover:underline cursor-pointer"
                    >
                      {a.title}
                    </button>
                    {a.author && (
                      <div className="text-xs text-neutral-400 mt-0.5">
                        লেখক: {[a.author.first_name, a.author.last_name].filter(Boolean).join(" ") || a.author.email}
                      </div>
                    )}
                    {a.status === "REJECTED" && a.rejection_feedback ? (
                      <div className="text-xs text-red-600 mt-1">
                        প্রত্যাখ্যানের কারণ: {a.rejection_feedback}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{a.category?.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-neutral-600 text-xs whitespace-nowrap">
                    <div className="font-medium text-neutral-800">
                      {formatBdDate(a.created_at || a.updated_at)}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {formatBdTime(a.created_at || a.updated_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {a.status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === a.id}
                        onClick={() => handleSubmit(a)}
                      >
                        {processingId === a.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-3 h-3 mr-1" /> সাবমিট
                          </>
                        )}
                      </Button>
                    )}
                    {isEditor && a.status !== "PUBLISHED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === a.id}
                        className="text-green-600 border-green-200 hover:bg-green-50 disabled:opacity-60"
                        onClick={() => handleApprove(a)}
                      >
                        {processingId === a.id ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> অনুমোদন হচ্ছে…
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" /> অনুমোদন
                          </>
                        )}
                      </Button>
                    )}
                    {isEditor && a.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === a.id}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => openRejectDialog(a.slug)}
                      >
                        <XCircle className="w-3 h-3 mr-1" /> প্রত্যাখ্যান
                      </Button>
                    )}
                    {isEditor && a.status === "PUBLISHED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === a.id}
                        onClick={() => handleRecall(a)}
                      >
                        {processingId === a.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <RotateCcw className="w-3 h-3 mr-1" /> রিকল
                          </>
                        )}
                      </Button>
                    )}
                    <Link
                      to="/admin/articles/$slug/edit"
                      params={{ slug: a.slug }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-neutral-100"
                    >
                      <Pencil className="w-3 h-3" /> এডিট
                    </Link>
                    <button
                      onClick={() => handleDelete(a.slug)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>প্রত্যাখ্যানের কারণ</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="feedback">ফিডব্যাক</Label>
            <Input
              id="feedback"
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              placeholder="কেন প্রত্যাখ্যান করা হচ্ছে..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              বাতিল
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectFeedback.trim()}>
              প্রত্যাখ্যান করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewArticle} onOpenChange={() => setPreviewArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewArticle?.title}</DialogTitle>
          </DialogHeader>
          {previewArticle && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 border-b pb-2">
                <span>
                  লেখক: {[previewArticle.author?.first_name, previewArticle.author?.last_name].filter(Boolean).join(" ") || previewArticle.author?.email || "অজানা"}
                </span>
                <span>ক্যাটাগরি: {previewArticle.category?.name}</span>
                <span>স্ট্যাটাস: {previewArticle.status}</span>
                <span>লেখার সময় (BD): {formatBdDateTime(previewArticle.created_at || previewArticle.updated_at)}</span>
              </div>

              {previewArticle.featured_image_url && (
                <img
                  src={previewArticle.featured_image_url}
                  alt=""
                  className="w-full max-h-64 object-cover rounded"
                />
              )}

              <div className="whitespace-pre-wrap leading-relaxed text-neutral-800">
                {previewArticle.content}
              </div>

              {previewArticle.status === "REJECTED" && previewArticle.rejection_feedback && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
                  <strong>প্রত্যাখ্যানের ফিডব্যাক:</strong> {previewArticle.rejection_feedback}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewArticle(null)}>
              বন্ধ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: ArticleStatus }) {
  const map: Record<ArticleStatus, string> = {
    DRAFT: "bg-neutral-100 text-neutral-700",
    PENDING: "bg-amber-100 text-amber-800",
    PUBLISHED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
}
