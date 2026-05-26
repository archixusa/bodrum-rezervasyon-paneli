// =========================================================================
// Edge Function: publish-property
// =========================================================================
// Body: { version_id: string }
// Pulls a property_site_versions row + linked images, writes MDX to the
// target site's repo via GitHub API, opens a PR. Updates version with
// commit SHA + published URL.
// =========================================================================

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

interface VersionRecord {
  id: string;
  template_id: string;
  site: string;
  slug: string;
  title: string;
  meta_description: string;
  h1: string;
  hero_subtitle: string | null;
  description_md: string;
  highlights: string[];
  faq: { q: string; a: string }[];
  featured_images: string[];
  schema_jsonld: Record<string, unknown>;
}

async function fetchVersion(id: string): Promise<VersionRecord | null> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/property_site_versions?id=eq.${id}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  const arr = await r.json();
  return arr?.[0] ?? null;
}

function buildMdx(v: VersionRecord): string {
  return `---
title: "${v.title.replace(/"/g, '\\"')}"
slug: "${v.slug}"
meta_description: "${v.meta_description.replace(/"/g, '\\"')}"
h1: "${v.h1.replace(/"/g, '\\"')}"
hero_subtitle: "${(v.hero_subtitle ?? "").replace(/"/g, '\\"')}"
featured_images:
${v.featured_images.map((u) => `  - "${u}"`).join("\n")}
highlights:
${v.highlights.map((h) => `  - "${h.replace(/"/g, '\\"')}"`).join("\n")}
faq:
${v.faq
  .map(
    (f) => `  - q: "${f.q.replace(/"/g, '\\"')}"\n    a: "${f.a.replace(/"/g, '\\"')}"`
  )
  .join("\n")}
---

${v.description_md}
`;
}

async function ghGet(repo: string, path: string) {
  const r = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/${path}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  if (r.status === 404) return null;
  return r.json();
}

async function ghPutFile(repo: string, path: string, content: string, message: string, branch: string) {
  // Encode in base64 — use TextEncoder then btoa-friendly
  const bytes = new TextEncoder().encode(content);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);
  const existing = await ghGet(repo, path);
  const body: Record<string, unknown> = {
    message,
    content: b64,
    branch,
  };
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
    }
  );
  if (!r.ok) {
    throw new Error(`GitHub PUT ${path} ${r.status}: ${await r.text()}`);
  }
  return r.json();
}

async function ghCreateBranch(repo: string, newBranch: string, fromBranch: string = "main") {
  const refRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/git/refs/heads/${fromBranch}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  if (!refRes.ok) throw new Error(`Cannot read main ref: ${refRes.status}`);
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
    }
  );
  if (!r.ok && r.status !== 422) {
    // 422 = already exists, that's fine
    throw new Error(`GitHub create branch ${r.status}: ${await r.text()}`);
  }
}

async function ghCreatePR(
  repo: string,
  branch: string,
  title: string,
  body: string
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
      body: JSON.stringify({
        title,
        body,
        head: branch,
        base: "main",
      }),
    }
  );
  if (!r.ok) {
    const errText = await r.text();
    if (errText.includes("A pull request already exists")) {
      return "(already exists)";
    }
    throw new Error(`GitHub create PR ${r.status}: ${errText}`);
  }
  const pr = await r.json();
  return pr.html_url;
}

async function updateVersionPublished(id: string, commitSha: string, filePath: string, publishedUrl: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/property_site_versions?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "published",
      github_commit_sha: commitSha,
      github_file_path: filePath,
      published_at: new Date().toISOString(),
      published_url: publishedUrl,
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body: { version_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { version_id } = body;
  if (!version_id) {
    return new Response(JSON.stringify({ error: "version_id required" }), { status: 400 });
  }
  try {
    const v = await fetchVersion(version_id);
    if (!v) return new Response("Version not found", { status: 404 });
    const repo = SITE_REPO_MAP[v.site];
    if (!repo) return new Response(`Unknown site: ${v.site}`, { status: 400 });

    const filePath = `content/properties/${v.slug}.mdx`;
    const branch = `auto/add-property-${v.slug}`;
    const mdx = buildMdx(v);

    await ghCreateBranch(repo, branch);
    const putRes = await ghPutFile(
      repo,
      filePath,
      mdx,
      `feat(content): add property ${v.slug}`,
      branch
    );
    const commitSha = putRes.commit?.sha ?? "";

    const prUrl = await ghCreatePR(
      repo,
      branch,
      `Add property: ${v.title}`,
      `Auto-generated property listing.\n\nSlug: \`${v.slug}\`\nVersion ID: \`${v.id}\`\n\nGörsel sayısı: ${v.featured_images.length}\n\nİncele ve merge et.`
    );

    const publishedUrl = `${SITE_URL_MAP[v.site]}/apartlar/${v.slug}`;
    await updateVersionPublished(v.id, commitSha, filePath, publishedUrl);

    return new Response(
      JSON.stringify({
        ok: true,
        commit_sha: commitSha,
        pr_url: prUrl,
        published_url: publishedUrl,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[publish]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
