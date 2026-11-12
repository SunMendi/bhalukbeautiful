import { useNavigate } from "@/admin/navigation";

import { useEffect, useState, type FormEvent } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { isEditorRole, isOwnerRole, articlesApi, categoriesApi, type Category } from "@/lib/api-client";
import { useAdminAuth } from "@/lib/admin-auth";
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
import { Send, CheckCircle2, Save, ImagePlus, X } from "lucide-react";
import { districts } from "@/lib/districts";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default () => (
    <AdminLayout>
      <NewArticlePage />
    </AdminLayout>
  );

function NewArticlePage() {
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [districtSlug, setDistrictSlug] = useState<string>("none");
  const [authorLabel, setAuthorLabel] = useState<string>("REPORTER");
  const [isBreaking, setIsBreaking] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const isEditor = isEditorRole(user?.role);
  const isAdmin = isOwnerRole(user?.role);

  useEffect(() => {
    categoriesApi
      .list()
      .then((c) => {
        setCats(c);
        if (c.length > 0) setCategoryId(String(c[0].id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "ক্যাটাগরি লোড ব্যর্থ"))
      .finally(() => setLoading(false));
  }, []);

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

  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
  };

  const handleCreate = async (e: FormEvent, mode: "DRAFT" | "SUBMIT" | "PUBLISH") => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !categoryId) {
      setError("সবগুলো আবশ্যক ঘর পূরণ করুন");
      return;
    }
    if (content.trim().length < 50) {
      setError("সংবাদের মূল লেখা অন্তত ৫০ অক্ষরের হতে হবে");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("status", "DRAFT");
      form.append("content", content.trim());
      form.append("category_id", categoryId);
      if (districtSlug && districtSlug !== "none") {
        form.append("districts", districtSlug);
      }
      if (authorLabel) {
        form.append("author_label", authorLabel);
      }
      form.append("is_breaking", String(isBreaking));
      if (imageFile) form.append("image", imageFile);

      const created = await articlesApi.createWithImage(form);

      if (mode === "SUBMIT") {
        await articlesApi.submit(created.slug);
      } else if (mode === "PUBLISH" && isEditor) {
        await articlesApi.submit(created.slug);
        await articlesApi.approve(created.slug);
      }

      navigate({
        to: "/admin/articles",
        search: {
          status: mode === "SUBMIT" ? "PENDING" : mode === "PUBLISH" ? "PUBLISHED" : "DRAFT",
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "পোস্ট তৈরি ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div aria-busy={loading}>
      <PageHeader
        title="নতুন পোস্ট তৈরি করুন"
        desc={
          isEditor
            ? "সম্পাদক হিসেবে পোস্ট লিখে সরাসরি প্রকাশ বা অনুমোদনের ড্রাফট রাখতে পারেন"
            : "রিপোর্টার হিসেবে পোস্ট লিখে অনুমোদনের জন্য সম্পাদকের কাছে পাঠান"
        }
      />

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        className="bg-white rounded-lg border p-6 max-w-3xl space-y-5"
        onSubmit={(e) => {
          const submitter = e.nativeEvent.submitter as HTMLButtonElement | null;
          const mode = submitter?.dataset.mode;
          void handleCreate(e, mode === "SUBMIT" || mode === "PUBLISH" ? mode : "DRAFT");
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="title">শিরোনাম *</Label>
          <Input
            id="title"
            required
            placeholder="সংবাদের আকর্ষণীয় শিরোনাম লিখুন..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>ক্যাটাগরি *</Label>
          <Select
            value={categoryId}
            onValueChange={setCategoryId}
            disabled={loading || cats.length === 0}
          >
            <SelectTrigger aria-busy={loading}>
              <SelectValue
                placeholder={loading ? "ক্যাটাগরি লোড হচ্ছে…" : "ক্যাটাগরি নির্বাচন করুন"}
              />
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
          <Select
            value={districtSlug}
            onValueChange={setDistrictSlug}
          >
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

        <div className="space-y-2">
          <Label htmlFor="featuredImage">প্রধান ছবি (Featured Image)</Label>
          {imagePreview ? (
            <div className="relative overflow-hidden rounded-lg border bg-neutral-50">
              <img
                src={imagePreview}
                alt="নির্বাচিত ছবির প্রিভিউ"
                className="aspect-video w-full object-cover"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/75 text-white shadow transition-colors hover:bg-black"
                aria-label="ছবি সরান"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="border-t bg-white px-4 py-3 text-xs text-neutral-600">
                {imageFile?.name}
              </div>
            </div>
          ) : (
            <label
              htmlFor="featuredImage"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center transition-colors hover:border-neutral-500 hover:bg-neutral-100"
            >
              <ImagePlus className="mb-3 h-8 w-8 text-neutral-500" />
              <span className="text-sm font-semibold text-neutral-800">ছবি নির্বাচন করুন</span>
              <span className="mt-1 text-xs text-neutral-500">
                JPG, PNG অথবা WebP · সর্বোচ্চ ৮ MB
              </span>
            </label>
          )}
          <Input
            id="featuredImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-neutral-500">
            এই ছবিটি হোমপেজ, ক্যাটাগরি পেজ এবং সংবাদের বিস্তারিত পাতায় দেখানো হবে।
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">সংবাদের বিবরণ * (কমপক্ষে ৫০ অক্ষর)</Label>
          <Textarea
            id="content"
            required
            minLength={50}
            rows={12}
            placeholder="সংবাদের বিস্তারিত বিষয়বস্তু লিখুন..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="text-xs text-neutral-500 text-right">দৈর্ঘ্য: {content.length} অক্ষর</p>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={isBreaking} onCheckedChange={setIsBreaking} id="breaking" />
          <Label htmlFor="breaking" className="cursor-pointer">
            ব্রেকিং নিউজ হিসেবে চিহ্নিত করুন
          </Label>
        </div>

        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <Button type="submit" data-mode="DRAFT" variant="outline" disabled={submitting}>
            <Save className="w-4 h-4 mr-2" />
            ড্রাফটে সংরক্ষণ করুন
          </Button>

          <Button type="submit" data-mode="SUBMIT" variant="default" disabled={submitting}>
            <Send className="w-4 h-4 mr-2" />
            অনুমোদনের জন্য জমা দিন
          </Button>

          {isEditor && (
            <Button
              type="submit"
              data-mode="PUBLISH"
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={submitting}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              সরাসরি প্রকাশ করুন
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate({ to: "/admin/articles", search: { status: "ALL" } })}
          >
            বাতিল
          </Button>
        </div>
      </form>
    </div>
  );
}
