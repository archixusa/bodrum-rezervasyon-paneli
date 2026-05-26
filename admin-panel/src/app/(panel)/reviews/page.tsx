import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { ReviewsClient } from "./ReviewsClient";
import type { ApartmentReview, ReviewInvitation } from "@/lib/types-reviews";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const supabase = await createClient();
  const [{ data: reviews }, { data: invitations }, { data: properties }] = await Promise.all([
    supabase
      .from("apartment_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("review_invitations")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(100),
    supabase.from("properties").select("id,name,slug"),
  ]);

  return (
    <>
      <PageHeader
        title="Misafir Değerlendirmeleri"
        desc="Onay bekleyen yorumları inceleyin. Sadece onayladıklarınız sitelerde görünür."
      />
      <ReviewsClient
        initialReviews={(reviews ?? []) as ApartmentReview[]}
        invitations={(invitations ?? []) as ReviewInvitation[]}
        properties={(properties ?? []) as Pick<Property, "id" | "name" | "slug">[]}
      />
    </>
  );
}
