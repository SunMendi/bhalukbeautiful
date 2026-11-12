import { useNavigate } from "@/admin/navigation";
import { useParams } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { isOwnerRole, articlesApi, categoriesApi, type ApiArticle, type Category } from "@/lib/api-client";
import { useAdminAuth } from "@/lib/admin-auth";
import { formatBdDateTime } from "@/lib/date-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePlus, X } from "lucide-react";
import { districts } from "@/lib/districts";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Keep the edit page independent from the article-list component.
export default () => (
    <AdminLayout>
      <EditArticlePage />
    </AdminLayout>
  );

function EditArticlePage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const isAdmin = isOwnerRole(user?.role);
  const [article, setArticle] = useState<ApiArticle | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [districtSlug, setDistrictSlug] = useState<string>("none");
  const [authorLabel, setAuthorLabel] = useState<string>("REPORTER");
  const [isBreaking, setIsBreaking] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    Promise.all([articlesApi.get(slug), categoriesApi.list()])
      .then(([a, c]) => {
        setArticle(a);
        setCats(c);
        setTitle(a.title);
        setContent(a.content ?? "");
        setCategoryId(String(a.category.id));
        const currentDistrict = a.districts && a.districts.length > 0 ? a.districts[0].slug : "none";
        setDistrictSlug(currentDistrict);
        const resolvedLabel = a.author_label || (a.author?.role === "EDITOR" || a.author?.role === "EIC" ? "EDITOR" : "REPORTER");
        setAuthorLabel(resolvedLabel);
        setIsBreaking(a.is_breaking);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "লোড ব্যর্থ"))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleImageChange = (file: File | null) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("শুধু JPG, PNG অথবা WebP ছবি আপলোড করুন");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError("ছবির আকার সর্বোচ্চ ৮ MB হতে পারবে");
      return;
    }

    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearSelectedImage = () => {
    setImageFile(null);
    setImagePreview("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("content", content.trim());
      form.append("category_id", categoryId);
      if (districtSlug && districtSlug !== "none") {
        form.append("districts", districtSlug);
      } else {
        form.append("districts", "");
      }
      if (isAdmin && authorLabel) {
        form.append("author_label", authorLabel);
      }
      form.append("is_breaking", String(isBreaking));
      if (imageFile) form.append("image", imageFile);

      await articlesApi.updateWithImage(slug, form);
      navigate({ to: "/admin/articles", search: { status: "ALL" } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-neutral-500">লোড হচ্ছে…</p>;
  if (!article) return <p className="text-red-600">পোস্ট পাওয়া যায়নি</p>;

  return (
    <>
      <PageHeader
        title="পোস্ট এডিট"
        desc={`স্ট্যাটাস: ${article.status} • লেখার সময় (BD): ${formatBdDateTime(article.created_at || article.updated_at)}`}
      />
      {article.status === "REJECTED" && article.rejection_feedback && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
          <strong>এডিটরের ফিডব্যাক:</strong> {article.rejection_feedback}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="bg-white rounded-lg border p-6 max-w-3xl space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">শিরোনাম</Label>
          <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>ক্যাটাগরি</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="ক্যাটাগরি বাছুন" />
            </SelectTrigger>
            <SelectContent>
              {cats.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>লোকেশন / জেলা (ঐচ্ছিক)</Label>
          <Select value={districtSlug} onValueChange={setDistrictSlug}>
            <SelectTrigger>
              <SelectValue placeholder="জেলা নির্বাচন করুন (ঐচ্ছিক)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">সারাদেশ / কোনো নির্দিষ্ট জেলা নেই</SelectItem>
              {districts.map((d) => (
                <SelectItem key={d.slug} value={d.slug}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <div className="space-y-2">
            <Label>লেখকের পরিচিতি / লেবেল</Label>
            <Select value={authorLabel} onValueChange={setAuthorLabel}>
              <SelectTrigger>
                <SelectValue placeholder="লেবেল নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REPORTER">নিজস্ব প্রতিবেদক</SelectItem>
                <SelectItem value="EDITOR">সম্পাদক</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-500">
              সংবাদ পাতায় লেখকের নাম দেখানোর পরিবর্তে এই লেবেলটি প্রদর্শিত হবে।
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="featuredImage">প্রধান ছবি (Featured Image)</Label>
          {(imagePreview || article.featured_image_url) && (
            <div className="relative overflow-hidden rounded-lg border bg-neutral-50">
              <img
                src={imagePreview || article.featured_image_url || ""}
                alt="সংবাদের প্রধান ছবির প্রিভিউ"
                className="aspect-video w-full object-cover"
              />
              {imagePreview && (
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/75 text-white shadow transition-colors hover:bg-black"
                  aria-label="নতুন নির্বাচিত ছবি বাতিল করুন"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          <label
            htmlFor="featuredImage"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-neutral-50"
          >
            <ImagePlus className="h-4 w-4" />
            {article.featured_image_url || imagePreview ? "ছবি পরিবর্তন করুন" : "ছবি নির্বাচন করুন"}
          </label>
          <Input
            id="featuredImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-neutral-500">
            JPG, PNG অথবা WebP · সর্বোচ্চ ৮ MB
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="content">কনটেন্ট</Label>
          <Textarea
            id="content"
            required
            minLength={50}
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={isBreaking} onCheckedChange={setIsBreaking} id="breaking" />
          <Label htmlFor="breaking">ব্রেকিং নিউজ</Label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "সংরক্ষণ হচ্ছে…" : "আপডেট করুন"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/admin/articles", search: { status: "ALL" } })}
          >
            বাতিল
          </Button>
        </div>
      </form>
    </>
  );
}
