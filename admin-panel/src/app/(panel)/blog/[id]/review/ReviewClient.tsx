"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Same Jaccard bigram helper as TopicsClient — kept duplicate for now
function jaccardBigram(a: string, b: string): number {
  const toBigrams = (s: string) => {
    const tokens = s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    const set = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) set.add(tokens[i] + " " + tokens[i + 1]);
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
import {
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  FileText,
  Eye,
  Code2,
} from "lucide-react";
import { useToaster } from "@/components/Toaster";
import type { BlogPost, BlogSiteVersion } from "@/lib/types-blog";
import { BLOG_SITE_LABELS } from "@/lib/types-blog";

export function ReviewClient({
  post,
  versions,
}: {
  post: BlogPost;
  versions: BlogSiteVersion[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const toaster = useToaster();
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingSite, setRegeneratingSite] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, BlogSiteVersion>>(() =>
    Object.fromEntries(versions.map((v) => [v.id, v]))
  );

  const similarity = versions[0]?.similarity_to_sibling ?? 0;

  // Subscribe to realtime updates — fire-and-forget pattern means we
  // wait for the version row to be updated/inserted, then refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`blog_versions_${post.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blog_site_versions", filter: `post_id=eq.${post.id}` },
        async () => {
          // Recompute similarity with newest data
          const { data: latest } = await supabase
            .from("blog_site_versions")
            .select("site,body_md")
            .eq("post_id", post.id);
          if (latest && latest.length === 2) {
            const [a, b] = latest;
            const sim = jaccardBigram(a.body_md, b.body_md);
            await supabase
              .from("blog_site_versions")
              .update({ similarity_to_sibling: sim })
              .eq("post_id", post.id);
          }
          // Clear local regenerating state; refresh page
          setRegeneratingSite(null);
          setRegenerating(false);
          toaster.push({
            title: "✨ Yeni versiyon hazır",
            body: "Sayfa otomatik yenileniyor",
            variant: "success",
          });
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  async function regenerateSingleSite(siteToRegen: BlogSiteVersion["site"]) {
    console.log("[blog-v3-fire-forget] regenerateSingleSite", { site: siteToRegen, postId: post.id });
    if (!confirm(`Sadece "${BLOG_SITE_LABELS[siteToRegen].label}" versiyonu yeniden üretilecek. (~80 sn)`))
      return;
    setRegeneratingSite(siteToRegen);
    try {
      // Fire-and-forget via direct fetch (bypasses any supabase-js timeout quirks).
      // Edge Function returns 202 immediately; work runs in background.
      // Realtime subscription handles completion.
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-blog-post`;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({ post_id: post.id, site: siteToRegen }),
      });
      console.log("[blog-v3-fire-forget] response status", res.status);
      if (!res.ok && res.status !== 202) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      toaster.push({
        title: `⏳ ${BLOG_SITE_LABELS[siteToRegen].label} üretiliyor`,
        body: "~80 sn sürer. Sayfa hazır olunca otomatik yenilenir.",
        variant: "success",
      });
    } catch (e) {
      console.error("[blog-v3-fire-forget] error", e);
      toaster.push({ title: "Başlatılamadı (v3)", body: (e as Error).message, variant: "error" });
      setRegeneratingSite(null);
    }
  }

  async function saveDraft(v: BlogSiteVersion) {
    const { error } = await supabase
      .from("blog_site_versions")
      .update({
        title: v.title,
        slug: v.slug,
        meta_title: v.meta_title,
        meta_description: v.meta_description,
        excerpt: v.excerpt,
        body_md: v.body_md,
        human_edited: true,
      })
      .eq("id", v.id);
    if (error) {
      toaster.push({ title: "Kaydedilemedi", body: error.message, variant: "error" });
      return;
    }
    toaster.push({ title: "Taslak kaydedildi", variant: "success" });
  }

  async function fireGenerate(site: BlogSiteVersion["site"]): Promise<void> {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-blog-post`;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify({ post_id: post.id, site }),
    });
    if (!res.ok && res.status !== 202) {
      throw new Error(`${site} HTTP ${res.status}`);
    }
  }

  async function regenerateAll() {
    if (!confirm("İki versiyon da yeniden üretilecek (~90 sn). Devam?"))
      return;
    setRegenerating(true);
    try {
      await Promise.all([
        fireGenerate("bodrumapartkiralama"),
        fireGenerate("bodrumapartvilla"),
      ]);
      toaster.push({
        title: "⏳ Tüm versiyonlar üretiliyor",
        body: "~90 sn sürer. Sayfa otomatik yenilenir.",
        variant: "success",
      });
    } catch (e) {
      toaster.push({ title: "Başlatılamadı (v3)", body: (e as Error).message, variant: "error" });
      setRegenerating(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white p-3">
        <div className="text-xs">
          <span className="font-semibold">Benzerlik:</span>{" "}
          <span
            className={`badge ${
              similarity < 0.3 ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
            }`}
          >
            %{Math.round(similarity * 100)}
          </span>{" "}
          <span className="text-muted">
            ({similarity < 0.3 ? "✓ iyi" : "⚠ çok benzer, tekrar üret"})
          </span>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={regenerateAll}
            disabled={regenerating}
            className="panel-btn-ghost"
          >
            <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
            Tümünü Yeniden Üret
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {versions.length === 0 ? (
          <p className="col-span-2 py-12 text-center text-muted">
            Bu post için henüz versiyon yok.
          </p>
        ) : (
          versions.map((v) => (
            <VersionCard
              key={v.id}
              version={drafts[v.id]}
              onChange={(updated) => setDrafts((p) => ({ ...p, [v.id]: updated }))}
              onSave={() => saveDraft(drafts[v.id])}
              onRegenerate={() => regenerateSingleSite(v.site)}
              isRegenerating={regeneratingSite === v.site}
            />
          ))
        )}
      </div>
    </>
  );
}

function VersionCard({
  version: v,
  onChange,
  onSave,
  onRegenerate,
  isRegenerating,
}: {
  version: BlogSiteVersion;
  onChange: (v: BlogSiteVersion) => void;
  onSave: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  const [tab, setTab] = useState<"preview" | "edit" | "raw">("preview");
  const site = BLOG_SITE_LABELS[v.site];

  return (
    <div className="panel-card flex flex-col">
      <header className="border-b border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className={`badge ${site.cls}`}>{site.label}</span>
            <p className="text-[11px] text-muted">{site.tone}</p>
          </div>
          <QualityPanel v={v} />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="panel-btn-ghost !py-1.5 !text-xs disabled:opacity-50"
            title="Sadece bu siteyi yeniden üret (~80 sn)"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
            {isRegenerating ? "Üretiliyor…" : "Bu Siteyi Yeniden Üret"}
          </button>
        </div>
      </header>

      <div className="flex border-b border-[var(--color-border)] text-xs">
        {(["preview", "edit", "raw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1 px-4 py-2 font-medium ${
              tab === t ? "border-b-2 border-navy-900 text-navy-900" : "text-muted hover:text-ink"
            }`}
          >
            {t === "preview" ? <Eye className="h-3.5 w-3.5" /> : null}
            {t === "edit" ? <FileText className="h-3.5 w-3.5" /> : null}
            {t === "raw" ? <Code2 className="h-3.5 w-3.5" /> : null}
            {t === "preview" ? "Önizleme" : t === "edit" ? "Düzenle" : "JSON"}
          </button>
        ))}
        <div className="ml-auto flex items-center px-3">
          <button onClick={onSave} className="panel-btn !py-1.5 !text-xs">
            <Save className="h-3.5 w-3.5" /> Kaydet
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "preview" && <PreviewPane v={v} />}
        {tab === "edit" && <EditPane v={v} onChange={onChange} />}
        {tab === "raw" && (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-navy-50/40 p-3 text-[11px]">
            {JSON.stringify(v, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function QualityPanel({ v }: { v: BlogSiteVersion }) {
  const issues = v.quality_issues ?? [];
  const passes = v.passes_quality_gate;
  return (
    <div className="text-right">
      <span
        className={`badge ${passes ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
      >
        {passes ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : <AlertTriangle className="mr-1 inline h-3 w-3" />}
        {passes ? "Quality Gate OK" : `${issues.length} issue`}
      </span>
      <div className="mt-1 flex flex-wrap justify-end gap-1 text-[10px]">
        <span className="text-muted">{v.word_count ?? "?"} kelime</span>
        <span className="text-muted">· {(v.inline_images ?? []).length} görsel</span>
        <span className="text-muted">· {(v.faq ?? []).length} FAQ</span>
        <span className="text-muted">
          · {v.has_local_signals ? "✓" : "✗"} local
        </span>
      </div>
      {!passes && issues.length > 0 && (
        <div className="mt-1 text-[10px] text-warning">
          {issues.slice(0, 3).join(" · ")}
        </div>
      )}
    </div>
  );
}

function PreviewPane({ v }: { v: BlogSiteVersion }) {
  return (
    <div className="space-y-3">
      <div className="rounded border border-[var(--color-border)] bg-navy-50/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Google'da nasıl görünür
        </p>
        <p className="mt-1 text-base text-blue-700">{v.meta_title || v.title}</p>
        <p className="text-xs text-success">
          bodrumapart{v.site === "bodrumapartkiralama" ? "kiralama" : "villa"}.com › blog ›{" "}
          {v.slug}
        </p>
        <p className="mt-1 text-sm text-ink">{v.meta_description}</p>
      </div>

      <div>
        <h2 className="text-xl font-bold">{v.title}</h2>
        <p className="text-xs text-muted">
          {v.word_count} kelime · {v.reading_time_min ?? "?"} dk okuma
        </p>
      </div>

      {v.excerpt && (
        <p className="rounded border border-[var(--color-border)] bg-warning/5 p-3 text-sm italic">
          {v.excerpt}
        </p>
      )}

      <article className="prose-blog text-sm">
        <MarkdownPreview md={v.body_md} />
      </article>

      {v.faq && v.faq.length > 0 && (
        <div className="mt-4 rounded border border-[var(--color-border)] p-3">
          <h3 className="mb-2 text-sm font-bold">FAQ</h3>
          <dl className="space-y-2">
            {v.faq.map((f, i) => (
              <div key={i}>
                <dt className="text-sm font-semibold">{f.q}</dt>
                <dd className="text-xs text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {v.internal_links && v.internal_links.length > 0 && (
        <div className="rounded border border-[var(--color-border)] bg-navy-50/30 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Internal link önerileri
          </p>
          <ul className="text-xs">
            {v.internal_links.map((l, i) => (
              <li key={i}>
                <span className="font-mono">{l.target}</span>
                <span className="text-muted"> ← "{l.anchor}"</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {v.inline_images && v.inline_images.length > 0 && (
        <div className="rounded border border-[var(--color-border)] bg-navy-50/30 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Görsel slot'ları (henüz indirilmedi)
          </p>
          <ul className="space-y-1 text-xs">
            {v.inline_images.map((s, i) => (
              <li key={i}>
                <span className="font-mono">{s.position}</span> · query:{" "}
                <span className="italic">"{s.search_query}"</span>
                <p className="text-muted">alt: {s.alt_suggestion}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {v.local_signals_found && v.local_signals_found.length > 0 && (
        <div className="rounded border border-[var(--color-border)] bg-success/5 p-3 text-xs">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-success">
            Tespit edilen local signals
          </p>
          <p>{v.local_signals_found.join(", ")}</p>
        </div>
      )}
    </div>
  );
}

function EditPane({
  v,
  onChange,
}: {
  v: BlogSiteVersion;
  onChange: (v: BlogSiteVersion) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      <Field label="Başlık">
        <input
          value={v.title}
          onChange={(e) => onChange({ ...v, title: e.target.value })}
          className="panel-input"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Slug">
          <input
            value={v.slug}
            onChange={(e) => onChange({ ...v, slug: e.target.value })}
            className="panel-input font-mono text-xs"
          />
        </Field>
        <Field
          label={`Meta description (${v.meta_description?.length ?? 0}/160)`}
          warn={
            !v.meta_description ||
            v.meta_description.length < 140 ||
            v.meta_description.length > 160
          }
        >
          <input
            value={v.meta_description ?? ""}
            onChange={(e) => onChange({ ...v, meta_description: e.target.value })}
            className="panel-input"
          />
        </Field>
      </div>
      <Field label="Excerpt">
        <textarea
          value={v.excerpt ?? ""}
          onChange={(e) => onChange({ ...v, excerpt: e.target.value })}
          rows={2}
          className="panel-input"
        />
      </Field>
      <Field label="Body (Markdown)">
        <textarea
          value={v.body_md}
          onChange={(e) => onChange({ ...v, body_md: e.target.value })}
          rows={24}
          className="panel-input font-mono text-xs"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
  warn,
}: {
  label: string;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <label className="block">
      <span
        className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide ${
          warn ? "text-warning" : "text-muted"
        }`}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

// Minimal markdown renderer — enough for preview without adding react-markdown dep
function MarkdownPreview({ md }: { md: string }) {
  // Very small Markdown subset: # ## ### **bold** *italic* - list, [text](url)
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length > 0) {
      out.push(
        <ul key={out.length} className="ml-4 list-disc space-y-1">
          {listBuf.map((l, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(l) }} />
          ))}
        </ul>
      );
      listBuf = [];
    }
  };
  for (const line of lines) {
    if (line.startsWith("## ")) {
      flushList();
      out.push(
        <h2 key={out.length} className="mt-4 text-lg font-bold">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      flushList();
      out.push(
        <h3 key={out.length} className="mt-3 text-base font-semibold">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuf.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      out.push(
        <p
          key={out.length}
          className="leading-relaxed"
          dangerouslySetInnerHTML={{ __html: inline(line) }}
        />
      );
    }
  }
  flushList();
  return <>{out}</>;
}

function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-navy-700 underline" target="_blank" rel="noreferrer">$1</a>');
}
