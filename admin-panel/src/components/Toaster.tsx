"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

type ToastVariant = "info" | "success" | "warning" | "error";
interface Toast {
  id: number;
  title: string;
  body?: string;
  variant: ToastVariant;
}

interface Ctx {
  push: (t: Omit<Toast, "id">) => void;
}

const ToasterCtx = createContext<Ctx | null>(null);
let nextId = 1;

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 7000);
  }, []);

  return (
    <ToasterCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-end gap-2 p-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto w-80 rounded-lg border bg-white p-4 shadow-cardHover",
              t.variant === "success" && "border-success/30",
              t.variant === "error" && "border-danger/30",
              t.variant === "warning" && "border-warning/30",
              t.variant === "info" && "border-navy-200"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{t.title}</p>
                {t.body && <p className="mt-0.5 text-xs text-muted">{t.body}</p>}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-muted hover:text-ink"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToasterCtx.Provider>
  );
}

export function useToaster() {
  const ctx = useContext(ToasterCtx);
  if (!ctx) throw new Error("useToaster must be used within ToasterProvider");
  return ctx;
}
