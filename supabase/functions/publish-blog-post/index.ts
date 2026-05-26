// =========================================================================
// Edge Function: publish-blog-post
// =========================================================================
// Input: { version_id: string }
//
// Behavior:
//  1. Load the blog_site_versions row + parent blog_posts row.
//  2. Build an MDX file (YAML frontmatter + markdown body) for the target site.
//  3. Use the GitHub REST API to:
//       - Create a branch `auto/blog-{slug}-{ts}` off main.
//       - PUT content/blog/{slug}.mdx (base64 encoded).
//       - Open a PR titled `feat(blog): {title}`.
//  4. Update blog_site_versions with github_pr_url, github_file_path,
//     github_commit_sha, status='published', published_at.
//  5. If both site versions of the same post are now published, mark
//     blog_posts.status='published'.
//
// Returns 202 immediately, real work runs in EdgeRuntime.waitUntil().
// =========================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const GITHUB_OWNER = Deno.env.get("GITHUB_OWNER") ?? "archixusa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const SITE_REPO_MAP: Record<string, string> = {
  bodrumapartkiralama: Deno.env.get("GITHUB_REPO_APARTKIRALAMA") ?? "bodrumapartkiralama-com",
  bodrumapartvilla: Deno.env.get("GITHUB_REPO_APARTVILLA") ?? "bodrumapartvilla-com",
};

const SITE_URL_MAP: Record<string, string> = {
  bodrumapartkiralama: "https://bodrumapartkiralama.com",
  bodrumapartvilla: "https://bodrumapartvilla.com",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

// ---------- helpers ------------------------------------------------------

function yamlEscape(s: string | null | undefined): string {
  if (s == null) return '""';
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").trim()}"`;
}

function yamlList(items: string[] | null | undefined, indent = 2): string {
  if (!items || items.length === 0) return "[]";
  const pad = " ".repeat(indent);
  return "\n" + items.map((i) => `${pad}- ${yamlEscape(i)}`).join("\n");
}

function buildFrontmatter(v: VersionRow, post: PostRow, todayIso: string): string {
  const hero = v.hero_image as { url?: string; alt?: string; alt_suggestion?: string } | null;
  const heroUrl = hero?.url ?? null;
  const heroAlt = hero?.alt ?? hero?.alt_suggestion ?? "";

  const keywords: string[] = (() => {
    const schema = (v.schema_jsonld ?? {}) as Record<string, unknown>;
    const kw = schema?.keywords;
    if (Array.isArray(kw)) return kw.filter((x): x is string => typeof x === "string");
    if (Array.isArray(post.related_keywords)) return post.related_keywords;
    return [];
  })();

  const faqBlock =
    v.faq && v.faq.length > 0
      ? "\n" +
        v.faq
          .map(
            (f) =>
              `  - q: ${yamlEscape(f.q)}\n    a: ${yamlEscape(f.a)}`,
          )
          .join("\n")
      : " []";

  // Schema as JSON string — gray-matter will parse the outer YAML, and
  // the consumer can JSON.parse this field as needed.
  const schemaJsonStr = JSON.stringify(v.schema_jsonld ?? {});

  return [
    "---",
    `title: ${yamlEscape(v.title)}`,
    `slug: ${yamlEscape(v.slug)}`,
    `site: ${yamlEscape(v.site)}`,
    `meta_title: ${yamlEscape(v.meta_title ?? v.title)}`,
    `meta_description: ${yamlEscape(v.meta_description)}`,
    `excerpt: ${yamlEscape(v.excerpt)}`,
    `published_at: ${yamlEscape(todayIso)}`,
    `author: "Furkan Şahin"`,
    `author_slug: "furkan-sahin"`,
    `hero_image: ${heroUrl ? yamlEscape(heroUrl) : "null"}`,
    `hero_image_alt: ${yamlEscape(heroAlt)}`,
    `reading_time_min: ${v.reading_time_min ?? 5}`,
    `word_count: ${v.word_count ?? 0}`,
    `keywords:${yamlList(keywords)}`,
    `faq:${faqBlock}`,
    `schema_jsonld: ${yamlEscape(schemaJsonStr)}`,
    `reklam_disclosure: ${v.requires_reklam_disclosure ? "true" : "false"}`,
    `topic: ${yamlEscape(post.topic)}`,
    `topic_category: ${yamlEscape(post.topic_category)}`,
    "---",
    "",
  ].join("\n");
}

function buildMdx(v: VersionRow, post: PostRow): string {
  const today = new Date().toISOString().slice(0, 10);
  const frontmatter = buildFrontmatter(v, post, today);
  return frontmatter + "\n" + v.body_md + "\n";
}

// ---------- types --------------------------------------------------------

interface VersionRow {
  id: string;
  post_id: string;
  site: string;
  title: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  excerpt: string | null;
  body_md: string;
  word_count: number | null;
  reading_time_min: number | null;
  hero_image: unknown;
  inline_images: unknown;
  schema_jsonld: unknown;
  internal_links: unknown;
  faq: Array<{ q: string; a: string }>;
  similarity_to_sibling: number | null;
  passes_quality_gate: boolean;
  quality_issues: string[] | null;
  requires_reklam_disclosure: boolean;
  status: string;
}

interface PostRow {
  id: string;
  topic: string;
  topic_category: string | null;
  primary_keyword: string | null;
  related_keywords: string[] | null;
  status: string;
}

// ---------- GitHub helpers ----------------------------------------------

async function ghGet(repo: string, path: string, branch?: string) {
  const url =
    `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/${path}` +
    (branch ? `?ref=${branch}` : "");
  const r = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (r.status === 404) return null;
  return r.json();
}

async function ghCreateBranch(repo: string, newBranch: string, fromBranch = "main") {
  const refRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/git/refs/heads/${fromBranch}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!refRes.ok) throw new Error(`Cannot read ${fromBranch} ref: ${refRes.status}`);
  const ref = await refRes.json();
  const sha = ref.object.sha;
  const r = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/git/refs`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
    },
  );
  if (!r.ok && r.status !== 422) {
    throw new Error(`GitHub create branch ${r.status}: ${await r.text()}`);
  }
  return sha as string;
}

async function ghPutFile(
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
) {
  const bytes = new TextEncoder().encode(content);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);
  const existing = await ghGet(repo, path, branch);
  const body: Record<string, unknown> = { message, content: b64, branch };
  if (existing?.sha) body.sha = existing.sha;
  const r = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) {
    throw new Error(`GitHub PUT ${path} ${r.status}: ${await r.text()}`);
  }
  return r.json();
}

async function ghCreatePR(
  repo: string,
  branch: string,
  title: string,
  body: string,
): Promise<string> {
  const r = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/pulls`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, head: branch, base: "main" }),
    },
  );
  if (!r.ok) {
    const errText = await r.text();
    if (errText.includes("A pull request already exists")) {
      // Look up the existing PR
      const list = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/pulls?head=${GITHUB_OWNER}:${branch}&state=open`,
        {
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (list.ok) {
        const arr = await list.json();
        if (Array.isArray(arr) && arr.length > 0) return arr[0].html_url as string;
      }
      return "(already exists)";
    }
    throw new Error(`GitHub create PR ${r.status}: ${errText}`);
  }
  const pr = await r.json();
  return pr.html_url as string;
}

// ---------- background worker -------------------------------------------

async function runPublish(version_id: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { data: v, error: vErr } = await sb
      .from("blog_site_versions")
      .select("*")
      .eq("id", version_id)
      .single();
    if (vErr || !v) throw new Error("version not found: " + vErr?.message);

    if (v.status !== "approved" && v.status !== "review") {
      throw new Error(`version status is "${v.status}" — only "review" or "approved" can be published`);
    }

    const { data: post, error: pErr } = await sb
      .from("blog_posts")
      .select("*")
      .eq("id", v.post_id)
      .single();
    if (pErr || !post) throw new Error("parent post not found: " + pErr?.message);

    const repo = SITE_REPO_MAP[v.site];
    if (!repo) throw new Error(`unknown site: ${v.site}`);

    const filePath = `content/blog/${v.slug}.mdx`;
    const ts = Date.now();
    const branch = `auto/blog-${v.slug}-${ts}`;
    const mdx = buildMdx(v as VersionRow, post as PostRow);

    console.log(`[publish-blog] starting v=${version_id} site=${v.site} repo=${repo} file=${filePath} branch=${branch}`);

    await ghCreateBranch(repo, branch);
    const putRes = await ghPutFile(
      repo,
      filePath,
      mdx,
      `feat(blog): add ${v.slug}`,
      branch,
    );
    const commitSha = putRes?.commit?.sha ?? "";

    const wc = v.word_count ?? 0;
    const sim = v.similarity_to_sibling != null ? `${Math.round(v.similarity_to_sibling * 100)}%` : "n/a";
    const issues = (v.quality_issues ?? []) as string[];
    const issueLine = issues.length === 0 ? "✅ quality gate OK" : `⚠️ ${issues.length} issue(s): ${issues.slice(0, 5).join(", ")}`;
    const reklamLine = v.requires_reklam_disclosure ? "\n\n⚖️ **#reklam etiketi içerir** (Türkiye Reklam Kurulu uyumu)" : "";

    const prBody = [
      `Auto-generated blog post.`,
      ``,
      `**Topic:** ${post.topic}`,
      `**Slug:** \`${v.slug}\``,
      `**Word count:** ${wc}`,
      `**Sibling similarity:** ${sim}`,
      `**Quality:** ${issueLine}`,
      reklamLine,
      ``,
      `Merge edersen Vercel siteyi otomatik rebuild eder.`,
      ``,
      `_Version ID: \`${v.id}\`_`,
    ].join("\n");

    const prUrl = await ghCreatePR(
      repo,
      branch,
      `feat(blog): ${v.title}`,
      prBody,
    );

    const publishedUrl = `${SITE_URL_MAP[v.site]}/blog/${v.slug}`;

    await sb
      .from("blog_site_versions")
      .update({
        github_pr_url: prUrl,
        github_file_path: filePath,
        github_commit_sha: commitSha,
        status: "published",
        published_at: new Date().toISOString(),
        published_url: publishedUrl,
      })
      .eq("id", v.id);

    // If both sites are now published, mark the post as published
    const { data: all } = await sb
      .from("blog_site_versions")
      .select("id,status")
      .eq("post_id", v.post_id);
    if (all && all.length >= 2 && all.every((row: { status: string }) => row.status === "published")) {
      await sb.from("blog_posts").update({ status: "published" }).eq("id", v.post_id);
    }

    console.log(`[publish-blog] done v=${version_id} pr=${prUrl}`);
  } catch (err) {
    console.error("[publish-blog] worker error", err);
    // Best-effort: record the error on the version row so the panel can show it
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      await sb
        .from("blog_site_versions")
        .update({
          quality_issues: [`publish_error: ${(err as Error).message}`],
        })
        .eq("id", version_id);
    } catch {}
  }
}

// ---------- handler ------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }
  if (!GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  let body: { version_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
  const { version_id } = body;
  if (!version_id) {
    return new Response(
      JSON.stringify({ error: "version_id required" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // Fire-and-forget: kick off work in background, return 202 immediately.
  // Client subscribes via Supabase Realtime on blog_site_versions to learn
  // when github_pr_url is filled in.
  // @ts-ignore — EdgeRuntime is a Supabase Edge Functions global
  EdgeRuntime.waitUntil(runPublish(version_id));

  return new Response(
    JSON.stringify({ ok: true, status: "publishing", version_id }),
    { status: 202, headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
