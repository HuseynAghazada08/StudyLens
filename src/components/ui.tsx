"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------- Button -------------------------------- */

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        variant === "primary" &&
          "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm",
        variant === "secondary" &&
          "bg-stone-100 text-stone-800 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700",
        variant === "ghost" &&
          "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
        className
      )}
      {...props}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* -------------------------------- Card --------------------------------- */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-stone-200 bg-white shadow-sm",
        "dark:border-stone-800 dark:bg-stone-900",
        className
      )}
      {...props}
    />
  );
}

/* -------------------------------- Badge -------------------------------- */

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "green" | "red" | "indigo" | "amber";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "neutral" &&
          "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
        tone === "green" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        tone === "red" &&
          "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        tone === "indigo" &&
          "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
        tone === "amber" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        className
      )}
      {...props}
    />
  );
}

/* ------------------------------- Spinner ------------------------------- */

export function Spinner({ label }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-3 text-stone-500 dark:text-stone-400"
      role="status"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

/* ------------------------------- Progress ------------------------------ */

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = Math.round((value / Math.max(1, max)) * 100);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
      role="progressbar"
      aria-label="Quiz progress"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full bg-indigo-600 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* --------------------------------- Tabs -------------------------------- */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-stone-50 p-1 dark:border-stone-800 dark:bg-stone-900"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          id={`tab-${t.id}`}
          aria-controls={`panel-${t.id}`}
          tabIndex={active === t.id ? 0 : -1}
          onKeyDown={e => {
            const index = tabs.findIndex(item => item.id === t.id);
            const next = e.key === "ArrowRight" ? (index + 1) % tabs.length : e.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
            if (next >= 0) { e.preventDefault(); onChange(tabs[next].id); document.getElementById(`tab-${tabs[next].id}`)?.focus(); }
          }}
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            active === t.id
              ? "bg-white text-indigo-700 shadow-sm dark:bg-stone-800 dark:text-indigo-300"
              : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------- Collapsible ----------------------------- */

export function Collapsible({
  title,
  meta,
  children,
  defaultOpen = false,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate font-medium">{title}</span>
          {meta}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-stone-400 transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-stone-100 px-5 py-4 dark:border-stone-800">
          {children}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ Empty state ---------------------------- */

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 px-6 py-12 text-center dark:border-stone-700">
      {icon && <div className="text-stone-400">{icon}</div>}
      <p className="font-medium text-stone-700 dark:text-stone-200">{title}</p>
      {hint && (
        <p className="text-sm text-stone-500 dark:text-stone-400">{hint}</p>
      )}
    </div>
  );
}
