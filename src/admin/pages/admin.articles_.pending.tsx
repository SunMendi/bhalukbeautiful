
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { articlesApi, type ApiArticle } from "@/lib/api-client";
import { formatBdDateTime } from "@/lib/date-format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// This is a sibling page, not a child rendered inside the article list.
export default () => (
    <AdminLayout>
      <PendingQueue />
    </AdminLayout>
  );

function PendingQueue() {
  const [items, setItems] = useState<ApiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectingSlug, setRejectingSlug] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    articlesApi
      .editorList("PENDING")
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "লোড ব্যর্থ"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = (slug: string) => setItems((prev) => prev.filter((a) => a.slug !== slug));

  const handleApprove = async (slug: string) => {
    setActionError(null);
    try {
      await articlesApi.approve(slug);
      remove(slug);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "অনুমোদন ব্যর্থ হয়েছে");
    }
  };

  const handleReject = async (slug: string) => {
    if (!feedback.trim()) return;
    setActionError(null);
    try {
      await articlesApi.reject(slug, feedback);
      remove(slug);
      setRejectingSlug(null);
      setFeedback("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "প্রত্যাখ্যান ব্যর্থ হয়েছে");
    }
  };

  const handleRecall = async (slug: string) => {
    setActionError(null);
    try {
      await articlesApi.recall(slug);
      remove(slug);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "ড্রাফটে ফেরত পাঠানো ব্যর্থ হয়েছে");
    }
  };

  return (
    <>
      <PageHeader
        title="অনুমোদনের জন্য অপেক্ষমাণ"
        desc="রিপোর্টারদের সাবমিট করা লেখাগুলি এখানে বিস্তারিত পড়ে অনুমোদন বা প্রত্যাখ্যান করুন"
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {actionError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded mb-4">
          {actionError}
        </div>
      )}

      {loading ? (
        <p className="text-neutral-500 text-sm">লোড হচ্ছে…</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-neutral-500">
          অনুমোদনের অপেক্ষায় কোনো লেখা নেই
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <div key={a.id} className="bg-white rounded-lg border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3
                    className="font-semibold text-lg hover:text-red-600 cursor-pointer"
                    onClick={() => setExpandedSlug(expandedSlug === a.slug ? null : a.slug)}
                  >
                    {a.title}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    লেখক: {[a.author?.first_name, a.author?.last_name].filter(Boolean).join(" ") || a.author?.email || "অজানা"} • ক্যাটাগরি: {a.category?.name ?? "N/A"} •{" "}
                    {formatBdDateTime(a.created_at || a.updated_at)}
                  </p>
                  {a.content && (
                    <div className="mt-3">
                      <p
                        className={`text-sm text-neutral-700 whitespace-pre-wrap ${expandedSlug === a.slug ? "" : "line-clamp-3"}`}
                      >
                        {a.content}
                      </p>
                      <button
                        onClick={() => setExpandedSlug(expandedSlug === a.slug ? null : a.slug)}
                        className="text-xs text-red-600 font-medium hover:underline mt-1 cursor-pointer"
                      >
                        {expandedSlug === a.slug ? "সংক্ষেপ দেখুন" : "সম্পূর্ণ লেখাটি পড়ুন..."}
                      </button>
                    </div>
                  )}
                </div>
                {a.featured_image_url && (
                  <img
                    src={a.featured_image_url}
                    alt=""
                    className="w-32 h-20 object-cover rounded shrink-0"
                    loading="lazy"
                  />
                )}
              </div>

              {rejectingSlug === a.slug ? (
                <div className="mt-4 space-y-2 bg-red-50 p-3 rounded border border-red-200">
                  <Textarea
                    placeholder="প্রত্যাখ্যানের সুস্পষ্ট কারণ লিখুন…"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(a.slug)}
                      disabled={!feedback.trim()}
                    >
                      নিশ্চিত প্রত্যাখ্যান
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRejectingSlug(null);
                        setFeedback("");
                      }}
                    >
                      বাতিল
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApprove(a.slug)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> অনুমোদন করুন
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setRejectingSlug(a.slug)}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> প্রত্যাখ্যান
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRecall(a.slug)}>
                    <RotateCcw className="w-4 h-4 mr-1" /> ড্রাফটে ফেরত
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
