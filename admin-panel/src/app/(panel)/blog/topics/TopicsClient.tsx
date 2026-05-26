"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, Plus, Trash2, Loader2, Wand2 } from "lucide-react";
import { useToaster } from "@/components/Toaster";
import type { BlogTopic, BlogTopicCategory, BlogSeasonality } from "@/lib/types-blog";
import {
  BLOG_CATEGORY_LABELS,
  BLOG_SEASON_LABELS,
} from "@/lib/types-blog";

// Jaccard bigram similarity — duplicates the helper in the edge fn for client-side scoring
function jaccardBigram(a: string, b: string): number {
  const toBigrams = (s: string) => {
    const tokens = s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    const set = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) {
      set.add(tokens[i] + " " + tokens[i + 1]);
    }
    return set;
  };
  const A = toBigrams(a);
  const B = toBigrams(b);
  if (A.size === 0 && B.size === 0) return 0;
  let intersect = 0;
  for (const x of A) if (B.has(x)) intersect++;
  const union = A.size + B.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

export function TopicsClient({
  initial,
  autoOpenGenerate: _autoOpenGenerate,
}: {
  initial: BlogTopic[];
  autoOpenGenerate?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toaster = useToaster();
  const router = useRouter();
  const [topics, setTopics] = useState<BlogTopic[]>(initial);
  const [filter, setFilter] = useState<"all" | "unused" | "used">("unused");
  const [suggesting, setSuggesting] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "all") return topics;
    return topics.filter((t) => (filter === "used" ? t.used : !t.used));
  }, [topics, filter]);

  async function suggestTopics() {
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-blog-topics", {
        body: { count: 10 },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Bilinmeyen hata");
      toaster.push({
        title: "✨ Yeni öneriler geldi",
        body: `${data.inserted} konu eklendi`,
        variant: "success",
      });
      const { data: refreshed } = await supabase
        .from("blog_topic_pool")
        .select("*")
        .order("used", { ascending: true })
        .order("created_at", { ascending: false });
      setTopics((refreshed ?? []) as BlogTopic[]);
    } catch (e) {
      toaster.push({
        title: "Öneri alınamadı",
        body: (e as Error).message,
        variant: "error",
      });
    } finally {
      setSuggesting(false);
    }
  }

  async function generateFromTopic(t: BlogTopic) {
    setGeneratingId(t.id);
    try {
      // 1. Create blog_posts row
      const { data: post, error: postErr } = await supabase
        .from("blog_posts")
        .insert({
          topic: t.topic,
          topic_category: t.category,
          brief: t.rationale,
          status: "generating",
        })
        .select("id")
        .single();
      if (postErr || !post) throw postErr ?? new Error("post insert failed");

      // 2. Mark topic used
      await supabase
        .from("blog_topic_pool")
        .update({ used: true, used_in_post_id: post.id, used_at: new Date().toISOString() })
        .eq("id", t.id);

      // 3. Invoke generate-blog-post TWICE in parallel (one per site).
      //    Each invocation has its own 150-sec Edge Function budget.
      const [kRes, vRes] = await Promise.all([
        supabase.functions.invoke("generate-blog-post", {
          body: { post_id: post.id, site: "bodrumapartkiralama" },
        }),
        supabase.functions.invoke("generate-blog-post", {
          body: { post_id: post.id, site: "bodrumapartvilla" },
        }),
      ]);

      const kData = kRes.data;
      const vData = vRes.data;
      if (kRes.error || !kData?.ok) {
        throw new Error("Kiralama versiyonu hatası: " + (kData?.error ?? kRes.error?.message));
      }
      if (vRes.error || !vData?.ok) {
        throw new Error("Villa versiyonu hatası: " + (vData?.error ?? vRes.error?.message));
      }

      // 4. Compute Jaccard bigram similarity
      const sim = jaccardBigram(kData.body_md, vData.body_md);

      // 5. Update both versions with similarity score
      await supabase
        .from("blog_site_versions")
        .update({ similarity_to_sibling: sim })
        .eq("post_id", post.id);

      // 6. Mark post as review-ready
      await supabase.from("blog_posts").update({ status: "review" }).eq("id", post.id);

      const totalCost = (kData.cost_usd ?? 0) + (vData.cost_usd ?? 0);
      toaster.push({
        title: "📝 Yazı taslağı hazır",
        body: `Benzerlik %${Math.round(sim * 100)} · ${kData.word_count}/${vData.word_count} kelime · $${totalCost.toFixed(3)}`,
        variant: "success",
      });
      router.push(`/blog/${post.id}/review`);
    } catch (e) {
      toaster.push({
        title: "Üretim başarısız",
        body: (e as Error).message,
        variant: "error",
      });
    } finally {
      setGeneratingId(null);
    }
  }

  async function deleteTopic(id: string) {
    if (!confirm("Konuyu sil?")) return;
    const { error } = await supabase.from("blog_topic_pool").delete().eq("id", id);
    if (error) {
      toaster.push({ title: "Silinemedi", body: error.message, variant: "error" });
      return;
    }
    setTopics((p) => p.filter((t) => t.id !== id));
  }

  async function addManual(form: ManualForm) {
    const { data, error } = await supabase
      .from("blog_topic_pool")
      .insert({
        topic: form.topic,
        category: form.category || null,
        primary_keyword: form.primary_keyword || null,
        seasonality: form.seasonality || "year_round",
        rationale: form.rationale || null,
        source: "manual",
      })
      .select()
      .single();
    if (error || !data) {
      toaster.push({ title: "Eklenemedi", body: error?.message ?? "?", variant: "error" });
      return;
    }
    setTopics((p) => [data as BlogTopic, ...p]);
    setShowManual(false);
    toaster.push({ title: "Eklendi", variant: "success" });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={suggestTopics}
          disabled={suggesting}
          className="panel-btn"
        >
          {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI'dan 10 Konu Öner
        </button>
        <button onClick={() => setShowManual(true)} className="panel-btn-ghost">
          <Plus className="h-4 w-4" /> Manuel Ekle
        </button>

        <div className="ml-auto flex gap-1 rounded-md border border-[var(--color-border)] bg-white p-1">
          {(["unused", "used", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-xs font-medium ${
                filter === f ? "bg-navy-900 text-white" : "text-ink hover:bg-navy-50"
              }`}
            >
              {f === "unused" ? "Kullanılmamış" : f === "used" ? "Kullanılmış" : "Hepsi"}
            </button>
          ))}
        </div>
      </div>

      {showManual && <ManualAddModal onClose={() => setShowManual(false)} onSubmit={addManual} />}

      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Konu</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Keyword</th>
              <th className="px-4 py-3">Sezon</th>
              <th className="px-4 py-3">Kaynak</th>
              <th className="px-4 py-3 text-right">Eylem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  Filtreye uygun konu yok. Üstten <span className="font-semibold">AI'dan 10 Konu Öner</span>'e bas.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className={t.used ? "opacity-50" : "hover:bg-navy-50/40"}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.topic}</p>
                    {t.rationale && (
                      <p className="text-[11px] text-muted">{t.rationale}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {t.category ? BLOG_CATEGORY_LABELS[t.category as BlogTopicCategory] : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">{t.primary_keyword ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {t.seasonality ? BLOG_SEASON_LABELS[t.seasonality as BlogSeasonality] : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        t.source === "ai_suggested"
                          ? "bg-accent-500/15 text-accent-600"
                          : "bg-navy-50 text-navy-700"
                      }`}
                    >
                      {t.source === "ai_suggested" ? "AI" : "Manuel"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!t.used && (
                        <button
                          onClick={() => generateFromTopic(t)}
                          disabled={generatingId === t.id}
                          className="panel-btn !py-1.5 !text-xs"
                          title="Bu konudan blog üret"
                        >
                          {generatingId === t.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Üretiliyor…
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3.5 w-3.5" />
                              Üret
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => deleteTopic(t.id)}
                        className="rounded-md p-2 text-muted hover:bg-danger/10 hover:text-danger"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {generatingId && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg bg-navy-900 px-4 py-3 text-sm text-white shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          <div>
            <p className="font-semibold">İçerik üretiliyor</p>
            <p className="text-xs text-white/70">~60-90 saniye sürer (iki site paralel)</p>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------- Manual add modal ----------------

interface ManualForm {
  topic: string;
  category: string;
  primary_keyword: string;
  seasonality: string;
  rationale: string;
}

function ManualAddModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (f: ManualForm) => void;
}) {
  const [f, setF] = useState<ManualForm>({
    topic: "",
    category: "destination_guide",
    primary_keyword: "",
    seasonality: "year_round",
    rationale: "",
  });
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-cardHover">
        <h2 className="mb-3 text-lg font-bold">Manuel Konu Ekle</h2>
        <div className="space-y-3 text-sm">
          <Field label="Konu (başlık taslağı)">
            <input
              autoFocus
              value={f.topic}
              onChange={(e) => setF({ ...f, topic: e.target.value })}
              className="panel-input"
              placeholder="örn. Yalıkavak'ta Eylül Ayında Yapılacak 7 Aktivite"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori">
              <select
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value })}
                className="panel-input"
              >
                {Object.entries(BLOG_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Sezon">
              <select
                value={f.seasonality}
                onChange={(e) => setF({ ...f, seasonality: e.target.value })}
                className="panel-input"
              >
                {Object.entries(BLOG_SEASON_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Primary keyword (opsiyonel)">
            <input
              value={f.primary_keyword}
              onChange={(e) => setF({ ...f, primary_keyword: e.target.value })}
              className="panel-input"
              placeholder="örn. yalıkavak eylül aktivite"
            />
          </Field>
          <Field label="Not (opsiyonel)">
            <textarea
              value={f.rationale}
              onChange={(e) => setF({ ...f, rationale: e.target.value })}
              rows={2}
              className="panel-input"
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="panel-btn-ghost">İptal</button>
          <button
            onClick={() => f.topic.trim() && onSubmit(f)}
            disabled={!f.topic.trim()}
            className="panel-btn"
          >
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
