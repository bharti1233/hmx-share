import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-[oklch(0.72_0.19_285)] to-[oklch(0.6_0.22_310)] opacity-25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-[oklch(0.78_0.16_200)] to-[oklch(0.72_0.15_170)] opacity-25 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10 sm:px-6">
        <Link to="/" className="mx-auto mb-8 block">
          <img src="/hmx-logo.png" alt="HMX Share" className="h-10 w-auto object-contain" />
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-3xl glass p-6 shadow-[var(--shadow-card)] sm:p-8"
        >
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </motion.div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </main>
    </div>
  );
}

export const fieldCls =
  "w-full rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60";

export const primaryBtnCls =
  "w-full rounded-xl bg-gradient-to-r from-[oklch(0.72_0.19_285)] to-[oklch(0.78_0.16_200)] px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform [touch-action:manipulation] active:scale-[0.98] disabled:opacity-60";
