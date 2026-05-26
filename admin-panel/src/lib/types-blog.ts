export type BlogPostStatus =
  | "idea"
  | "generating"
  | "review"
  | "approved"
  | "published"
  | "archived";

export type BlogSite = "bodrumapartkiralama" | "bodrumapartvilla";

export type BlogTopicCategory =
  | "destination_guide"
  | "seasonal"
  | "long_tail_seo"
  | "travel_tips"
  | "local_food"
  | "activity"
  | "event"
  | "how_to";

export type BlogSeasonality = "spring" | "summer" | "fall" | "winter" | "year_round";

export interface BlogPost {
  id: string;
  topic: string;
  topic_category: BlogTopicCategory | null;
  primary_keyword: string | null;
  related_keywords: string[] | null;
  target_region: string | null;
  target_season: BlogSeasonality | null;
  brief: string | null;
  local_signals: unknown;
  status: BlogPostStatus;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogTopic {
  id: string;
  topic: string;
  category: BlogTopicCategory | null;
  primary_keyword: string | null;
  related_keywords: string[] | null;
  estimated_search_volume: number | null;
  difficulty: number | null;
  seasonality: BlogSeasonality | null;
  rationale: string | null;
  notes: string | null;
  used: boolean;
  used_in_post_id: string | null;
  used_at: string | null;
  source: "ai_suggested" | "manual" | "gsc_query";
  created_at: string;
}

export interface BlogSiteVersion {
  id: string;
  post_id: string;
  site: BlogSite;
  title: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  excerpt: string | null;
  body_md: string;
  word_count: number | null;
  reading_time_min: number | null;
  hero_image: { url?: string; alt?: string; search_query?: string; alt_suggestion?: string; position?: string } | null;
  inline_images: Array<{ search_query: string; alt_suggestion: string; position: string; url?: string }>;
  schema_jsonld: unknown;
  internal_links: Array<{ anchor: string; target: string }>;
  faq: Array<{ q: string; a: string }>;
  similarity_to_sibling: number | null;
  has_local_signals: boolean;
  local_signals_found: string[] | null;
  passes_quality_gate: boolean;
  quality_issues: string[];
  github_pr_url: string | null;
  published_url: string | null;
  published_at: string | null;
  generated_at: string;
  generation_cost_usd: number | null;
  human_edited: boolean;
  status: "draft" | "review" | "approved" | "published" | "archived";
}

export const BLOG_CATEGORY_LABELS: Record<BlogTopicCategory, string> = {
  destination_guide: "Bölge Rehberi",
  seasonal: "Mevsimsel",
  long_tail_seo: "Long-tail SEO",
  travel_tips: "Seyahat Tüyoları",
  local_food: "Gastronomi",
  activity: "Aktivite",
  event: "Etkinlik",
  how_to: "Nasıl Yapılır",
};

export const BLOG_SEASON_LABELS: Record<BlogSeasonality, string> = {
  spring: "İlkbahar",
  summer: "Yaz",
  fall: "Sonbahar",
  winter: "Kış",
  year_round: "Yıl Boyu",
};

export const BLOG_SITE_LABELS: Record<BlogSite, { label: string; cls: string; tone: string }> = {
  bodrumapartkiralama: {
    label: "Apartkiralama",
    cls: "bg-navy-100 text-navy-800",
    tone: "Aile / pratik",
  },
  bodrumapartvilla: {
    label: "Apartvilla",
    cls: "bg-accent-500/15 text-accent-600",
    tone: "Premium / butik",
  },
};
