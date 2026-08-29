"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, X } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
  href?: string;
  closing: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: "success" | "error", href?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Toasts are a list, not a single open/closed value, so each one needs its
// own delayed removal rather than reusing useDelayedUnmount (built for one
// boolean) - mark it closing first so the exit animation can play, then
// actually remove it from the array once that's done.
const EXIT_DURATION = 150;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function startDismiss(id: string) {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, closing: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_DURATION);
  }

  function showToast(message: string, type: "success" | "error" = "success", href?: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type, href, closing: false }]);
    // Longer when there's something to click - a toast that vanishes before
    // you've had a chance to read and click it isn't really a link.
    setTimeout(() => startDismiss(id), href ? 6000 : 3500);
  }

  function dismiss(id: string) {
    startDismiss(id);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-state={toast.closing ? "closing" : "open"}
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg toast-enter bg-white ${
              toast.type === "success"
                ? "border-green-200 text-green-700"
                : "border-red-200 text-red-700"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={18} className="flex-shrink-0" />
            ) : (
              <XCircle size={18} className="flex-shrink-0" />
            )}
            {toast.href ? (
              <Link
                href={toast.href}
                onClick={() => dismiss(toast.id)}
                className="text-sm text-neutral-900 flex-1 hover:underline underline-offset-2"
              >
                {toast.message}
              </Link>
            ) : (
              <span className="text-sm text-neutral-900 flex-1">
                {toast.message}
              </span>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              className="text-neutral-400 hover:text-neutral-600 active:scale-[0.9] transition-transform duration-150 ease-out-quart flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
