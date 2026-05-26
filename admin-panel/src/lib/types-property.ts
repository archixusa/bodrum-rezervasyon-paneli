export type PropertyTemplateStatus =
  | "draft"
  | "generating"
  | "review"
  | "published"
  | "archived";

export type SiteVersionStatus =
  | "draft"
  | "generating"
  | "review"
  | "approved"
  | "published"
  | "archived";

export interface PropertyTemplate {
  id: string;
  internal_name: string;
  region: string;
  district: string | null;
  type: "villa" | "apart" | "daire" | "apart_otel";
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number | null;
  size_m2: number | null;
  has_pool: boolean;
  pool_type: string | null;
  has_garden: boolean;
  distance_to_beach_m: number | null;
  distance_to_center_m: number | null;
  amenities: Record<string, unknown> | null;
  base_price_try: number | null;
  base_price_eur: number | null;
  raw_description: string | null;
  highlights: string[] | null;
  owner_id: string | null;
  status: PropertyTemplateStatus;
  created_at: string;
  updated_at: string;
}

export interface PropertySiteVersion {
  id: string;
  template_id: string;
  site: "bodrumapartkiralama" | "bodrumapartvilla";
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
  github_commit_sha: string | null;
  github_file_path: string | null;
  published_at: string | null;
  published_url: string | null;
  generated_at: string | null;
  generation_model: string | null;
  generation_tokens: number | null;
  human_edited: boolean;
  status: SiteVersionStatus;
  created_at: string;
  updated_at: string;
}

export interface PropertyImage {
  id: string;
  template_id: string;
  storage_path: string;
  public_url: string;
  alt_text: string | null;
  display_order: number;
  is_hero: boolean;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: string;
}
