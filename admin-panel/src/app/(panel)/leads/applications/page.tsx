import { redirect } from "next/navigation";

// Moved to top-level /applications
export default function LegacyApplicationsRedirect() {
  redirect("/applications");
}
