import { Sidebar } from "@/components/Sidebar";
import { ToasterProvider } from "@/components/Toaster";

// Auth is verified in middleware.ts on every panel request — no need to re-check here.
// This eliminates a duplicate ~200-400ms Supabase Auth round-trip per navigation.

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToasterProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden p-6 lg:p-8">{children}</main>
      </div>
    </ToasterProvider>
  );
}
