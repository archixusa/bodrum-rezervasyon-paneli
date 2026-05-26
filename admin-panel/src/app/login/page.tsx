"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Mail, Loader2 } from "lucide-react";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="panel-card w-full max-w-md p-8"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900">
            <span className="text-2xl">🏝</span>
          </div>
          <h1 className="text-xl font-bold">Rezervasyon Paneli</h1>
          <p className="mt-1 text-sm text-muted">Sadece davetli yöneticiler giriş yapabilir.</p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              E-posta
            </span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="panel-input pl-10"
                autoComplete="email"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Şifre
            </span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="panel-input pl-10"
                autoComplete="current-password"
              />
            </div>
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="panel-btn-accent mt-6 w-full">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>

        <p className="mt-6 text-center text-[11px] text-muted">
          Şifren yoksa Supabase Studio → Authentication → Users'tan davet edilmelisin.
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
