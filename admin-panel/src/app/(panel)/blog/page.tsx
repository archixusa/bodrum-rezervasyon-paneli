import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Sparkles, FileText, Lightbulb, Clock, CheckCircle2 } from "lucide-react";
import { timeAgo } from "@/lib/format";
import type { BlogPost, BlogSiteVersion } from "@/lib/types-blog";
import { BLOG_SITE_LABELS, BLOG_CATEGORY_LABELS } from "@/lib/types-blog";

export const dynamic = "force-dynamic";

export default async function BlogDashboardPage() {
  const supabase = await createClient();
  const [{ data: posts }, { data: versions }, { data: poolStats }] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("blog_site_versions")
      .select("id,post_id,site,title,status,word_count,similarity_to_sibling,passes_quality_gate,quality_issues,generated_at,published_at"),
    supabase.from("blog_topic_pool").select("id,used"),
  ]);

  const postList = (posts ?? []) as BlogPost[];
  const versionsByPost = new Map<string, BlogSiteVersion[]>();
  for (const v of (versions ?? []) as BlogSiteVersion[]) {
    const arr = versionsByPost.get(v.post_id) ?? [];
    arr.push(v);
    versionsByPost.set(v.post_id, arr);
  }

  const reviewCount = postList.filter((p) => p.status === "review").length;
  const publishedThisMonth = postList.filter((p) => {
    if (p.status !== "published") return false;
    const d = new Date(p.updated_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const generatingCount = postList.filter((p) => p.status === "generating").length;
  const unusedTopics = (poolStats ?? []).filter((t: { used: boolean }) => !t.used).length;

  return (
    <>
      <PageHeader
        title="Blog"
        desc="İki sitede otomatik blog yazma sistemi. AI taslak üretir → sen review edip yayınlarsın."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Clock className="h-5 w-5 text-warning" />}
          label="Review bekliyor"
          value={reviewCount}
          accent={reviewCount > 0}
        />
        <Kpi
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
          label="Bu ay yayında"
          value={publishedThisMonth}
        />
        <Kpi
          icon={<Sparkles className="h-5 w-5 text-accent-500" />}
          label="Üretim sürüyor"
          value={generatingCount}
        />
        <Kpi
          icon={<Lightbulb className="h-5 w-5 text-navy-700" />}
          label="Konu havuzu"
          value={unusedTopics}
          sub="kullanılmamış"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/blog/topics" className="panel-btn-ghost">
          <Lightbulb className="h-4 w-4" /> Konu Havuzu
        </Link>
        <Link href="/blog/topics?generate=1" className="panel-btn">
          <Sparkles className="h-4 w-4" /> Yeni Yazı Üret
        </Link>
      </div>

      <div className="panel-card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-navy-50/40 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Konu</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Versiyonlar</th>
              <th className="px-4 py-3">Kalite</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Zaman</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {postList.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted">
                  Henüz yazı yok. Üstteki <span className="font-semibold">Konu Havuzu</span>'na git ve AI ile başla.
                </td>
              </tr>
            ) : (
              postList.map((p) => {
                const vs = versionsByPost.get(p.id) ?? [];
                return (
                  <tr key={p.id} className="hover:bg-navy-50/40">
                    <td className="px-4 py-3">
                      <Link href={`/blog/${p.id}/review`} className="font-semibold hover:underline">
                        {p.topic}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {p.topic_category ? BLOG_CATEGORY_LABELS[p.topic_category] : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {vs.map((v) => {
                          const s = BLOG_SITE_LABELS[v.site];
                          return (
                            <span key={v.id} className={`badge ${s.cls}`}>
                              {s.label} · {v.word_count ?? "?"}sw
                            </span>
                          );
                        })}
                        {vs.length === 0 && <span className="text-xs text-muted">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {vs.length > 0 ? (
                        <QualityBadges versions={vs} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{timeAgo(p.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/blog/${p.id}/review`}
                        className="text-xs font-semibold text-navy-600 hover:underline"
                      >
                        Aç →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`panel-card flex items-center gap-3 p-4 ${accent ? "ring-1 ring-warning/30" : ""}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BlogPost["status"] }) {
  const map: Record<BlogPost["status"], { label: string; cls: string }> = {
    idea: { label: "Fikir", cls: "bg-navy-50 text-navy-700" },
    generating: { label: "Üretiliyor", cls: "bg-accent-500/15 text-accent-600" },
    review: { label: "Review", cls: "bg-warning/15 text-warning" },
    approved: { label: "Onaylı", cls: "bg-success/15 text-success" },
    published: { label: "Yayında", cls: "bg-success/15 text-success" },
    archived: { label: "Arşiv", cls: "bg-navy-50 text-muted" },
  };
  const m = map[status];
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

function QualityBadges({ versions }: { versions: BlogSiteVersion[] }) {
  const allPass = versions.every((v) => v.passes_quality_gate);
  const sim = versions[0]?.similarity_to_sibling ?? 0;
  return (
    <div className="flex flex-wrap gap-1">
      <span
        className={`badge ${allPass ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
      >
        {allPass ? <FileText className="mr-1 inline h-3 w-3" /> : null}
        {allPass ? "Gate OK" : "Issues"}
      </span>
      {sim > 0 && (
        <span
          className={`badge ${
            sim < 0.3 ? "bg-navy-50 text-navy-700" : "bg-danger/15 text-danger"
          }`}
        >
          sim {Math.round(sim * 100)}%
        </span>
      )}
    </div>
  );
}
