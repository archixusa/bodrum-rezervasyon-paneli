"use client";

import { useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { useToaster } from "@/components/Toaster";
import {
  RefreshCw,
  Save,
  Rocket,
  Loader2,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import type {
  PropertyTemplate,
  PropertySiteVersion,
  PropertyImage,
} from "@/lib/types-property";

interface Props {
  template: PropertyTemplate;
  versions: PropertySiteVersion[];
  images: PropertyImage[];
}

const SITES = ["bodrumapartkiralama", "bodrumapartvilla"] as const;
type Site = (typeof SITES)[number];

const SITE_LABEL: Record<Site, string> = {
  bodrumapartkiralama: "Bodrumapartkiralama (aile/pratik)",
  bodrumapartvilla: "Bodrumapartvilla (lüks)",
};

export function ReviewClient({ template, versions, images }: Props) {
  const supabase = createClient();
  const toaster = useToaster();
  const [activeSite, setActiveSite] = useState<Site>("bodrumapartkiralama");
  const [working, setWorking] = useState(false);

  const versionMap = new Map(versions.map((v) => [v.site, v]));
  const v = versionMap.get(activeSite);

  const [title, setTitle] = useState(v?.title ?? "");
  const [slug, setSlug] = useState(v?.slug ?? "");
  const [meta, setMeta] = useState(v?.meta_description ?? "");
  const [h1, setH1] = useState(v?.h1 ?? "");
  const [heroSub, setHeroSub] = useState(v?.hero_subtitle ?? "");
  const [desc, setDesc] = useState(v?.description_md ?? "");
  const [highlights, setHighlights] = useState(
    v ? v.highlights.join("\n") : ""
  );
  const [faq, setFaq] = useState(
    v?.faq?.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n") ?? ""
  );

  function loadVersion(site: Site) {
    setActiveSite(site);
    const x = versionMap.get(site);
    setTitle(x?.title ?? "");
    setSlug(x?.slug ?? "");
    setMeta(x?.meta_description ?? "");
    setH1(x?.h1 ?? "");
    setHeroSub(x?.hero_subtitle ?? "");
    setDesc(x?.description_md ?? "");
    setHighlights(x ? x.highlights.join("\n") : "");
    setFaq(x?.faq?.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n") ?? "");
  }

  function parseFaq(s: string): { q: string; a: string }[] {
    return s
      .split(/\n\s*\n/)
      .map((block) => {
        const q = block.match(/^Q:\s*(.+)$/m)?.[1]?.trim() ?? "";
        const a = block.match(/^A:\s*([\s\S]+)/m)?.[1]?.trim() ?? "";
        return { q, a };
      })
      .filter((f) => f.q && f.a);
  }

  async function saveDraft() {
    if (!v) return;
    setWorking(true);
    const { error } = await supabase
      .from("property_site_versions")
      .update({
        title,
        slug,
        meta_description: meta,
        h1,
        hero_subtitle: heroSub,
        description_md: desc,
        highlights: highlights.split("\n").map((s) => s.trim()).filter(Boolean),
        faq: parseFaq(faq),
        human_edited: true,
      })
      .eq("id", v.id);
    setWorking(false);
    if (error) toaster.push({ title: "Kaydedilemedi", body: error.message, variant: "error" });
    else toaster.push({ title: "Taslak kaydedildi", variant: "success" });
  }

  async function regenerate() {
    setWorking(true);
    const { error } = await supabase.functions.invoke("generate-property-content", {
      body: { template_id: template.id, site: activeSite },
    });
    setWorking(false);
    if (error)
      toaster.push({ title: "Yeniden üretim başarısız", body: error.message, variant: "error" });
    else {
      toaster.push({
        title: "Yeniden üretildi",
        body: "Sayfayı yenileyin",
        variant: "success",
      });
    }
  }

  async function publish() {
    if (!v) return;
    setWorking(true);
    // Save current edits first
    await supabase
      .from("property_site_versions")
      .update({
        title,
        slug,
        meta_description: meta,
        h1,
        hero_subtitle: heroSub,
        description_md: desc,
        highlights: highlights.split("\n").map((s) => s.trim()).filter(Boolean),
        faq: parseFaq(faq),
        status: "approved",
        human_edited: true,
      })
      .eq("id", v.id);
    const { data, error } = await supabase.functions.invoke("publish-property", {
      body: { version_id: v.id },
    });
    setWorking(false);
    if (error || (data as { error?: string })?.error) {
      toaster.push({
        title: "Yayın başarısız",
        body: error?.message ?? (data as { error?: string })?.error,
        variant: "error",
      });
    } else {
      const result = data as { pr_url?: string; published_url?: string };
      toaster.push({
        title: "Yayın PR'ı açıldı",
        body: result.pr_url ?? "",
        variant: "success",
      });
    }
  }

  const similarityWarning = useSimilarity(versions);

  return (
    <div className="space-y-4">
      {similarityWarning && (
        <div className="panel-card border-l-4 border-warning bg-warning/5 p-4 text-sm">
          <p className="font-semibold text-warning">⚠ Benzerlik uyarısı</p>
          <p className="mt-1 text-muted">{similarityWarning}</p>
          <p className="mt-2 text-xs text-muted">
            İki sitenin içeriği fazla benziyor — duplicate content riski. Birini
            yeniden üretmeyi veya elle düzenlemeyi düşünün.
          </p>
        </div>
      )}

      {/* Site tabs */}
      <div className="panel-card flex items-center gap-2 p-2">
        {SITES.map((s) => {
          const exists = versionMap.has(s);
          return (
            <button
              key={s}
              onClick={() => loadVersion(s)}
              className={clsx(
                "flex-1 rounded-md px-4 py-2 text-sm font-semibold transition",
                activeSite === s
                  ? "bg-navy-900 text-white"
                  : "bg-white text-ink hover:bg-navy-50"
              )}
            >
              {SITE_LABEL[s]}
              {!exists && (
                <span className="ml-2 text-[10px] text-warning">(üretilmedi)</span>
              )}
            </button>
          );
        })}
      </div>

      {!v ? (
        <div className="panel-card p-10 text-center text-muted">
          Bu site için içerik henüz üretilmemiş. Yeni Mülk akışını kullanarak üretmeniz lazım.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* Editor */}
          <div className="panel-card space-y-4 p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="label">Title (SEO)</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="panel-input"
                />
                <p className="mt-1 text-[10px] text-muted">
                  {title.length}/60 karakter
                </p>
              </label>
              <label className="block">
                <span className="label">Slug (URL)</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="panel-input font-mono"
                />
              </label>
            </div>
            <label className="block">
              <span className="label">Meta description</span>
              <textarea
                rows={2}
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                className="panel-input"
              />
              <p className="mt-1 text-[10px] text-muted">{meta.length}/160 karakter</p>
            </label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="label">H1</span>
                <input
                  type="text"
                  value={h1}
                  onChange={(e) => setH1(e.target.value)}
                  className="panel-input"
                />
              </label>
              <label className="block">
                <span className="label">Hero subtitle</span>
                <input
                  type="text"
                  value={heroSub}
                  onChange={(e) => setHeroSub(e.target.value)}
                  className="panel-input"
                />
              </label>
            </div>
            <label className="block">
              <span className="label">Açıklama (Markdown)</span>
              <textarea
                rows={14}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="panel-input font-mono text-xs leading-relaxed"
              />
              <p className="mt-1 text-[10px] text-muted">
                {desc.split(/\s+/).filter(Boolean).length} kelime
              </p>
            </label>
            <label className="block">
              <span className="label">Highlights (satır başına bir)</span>
              <textarea
                rows={5}
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
                className="panel-input"
              />
            </label>
            <label className="block">
              <span className="label">FAQ (Q: / A: formatında)</span>
              <textarea
                rows={10}
                value={faq}
                onChange={(e) => setFaq(e.target.value)}
                className="panel-input font-mono text-xs"
                placeholder="Q: Soru?&#10;A: Cevap.&#10;&#10;Q: Diğer soru?&#10;A: Diğer cevap."
              />
            </label>

            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={regenerate} disabled={working} className="panel-btn-ghost">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Yeniden Üret
              </button>
              <button onClick={saveDraft} disabled={working} className="panel-btn">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Taslak Kaydet
              </button>
              <button onClick={publish} disabled={working} className="panel-btn-accent">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Onayla ve Yayınla
              </button>
              {v.published_url && (
                <a
                  href={v.published_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="panel-btn-ghost"
                >
                  <ExternalLink className="h-4 w-4" /> Canlı
                </a>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-navy-50 p-3 text-xs">
              <div>
                <p className="text-muted">Durum</p>
                <p className="font-semibold capitalize">{v.status}</p>
              </div>
              <div>
                <p className="text-muted">AI tokenleri</p>
                <p className="font-semibold">{v.generation_tokens ?? "—"}</p>
              </div>
              {v.published_at && (
                <div className="col-span-2">
                  <p className="text-muted">Yayında</p>
                  <p className="font-semibold">{new Date(v.published_at).toLocaleString("tr-TR")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: images + meta */}
          <aside className="space-y-4">
            <div className="panel-card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <ImageIcon className="h-4 w-4" /> Fotoğraflar
                <span className="ml-auto text-xs text-muted">{images.length}</span>
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                {images.map((img) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={img.id}
                    src={img.public_url}
                    alt=""
                    className={clsx(
                      "aspect-square w-full rounded object-cover",
                      img.is_hero && "ring-2 ring-accent-500"
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="panel-card p-4 text-xs text-muted">
              <p>
                <strong>Persona:</strong> {SITE_LABEL[activeSite]}
              </p>
              <p className="mt-2">
                <strong>Model:</strong> {v.generation_model ?? "—"}
              </p>
              <p className="mt-2">
                <strong>Üretildi:</strong>{" "}
                {v.generated_at
                  ? new Date(v.generated_at).toLocaleString("tr-TR")
                  : "—"}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function useSimilarity(versions: PropertySiteVersion[]): string | null {
  if (versions.length < 2) return null;
  const a = versions[0].description_md;
  const b = versions[1].description_md;
  const ja = jaccard(tokenize(a), tokenize(b));
  if (ja > 0.55) {
    return `İki sitenin açıklamaları arasında ${Math.round(
      ja * 100
    )}% benzerlik var (kelime kümesi bazında).`;
  }
  return null;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  a.forEach((w) => {
    if (b.has(w)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
