import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Upload, Download, Shield, Zap, Clock, QrCode } from "lucide-react";
import { Nav } from "@/components/Nav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HMX Share — Fast, secure file sharing with expiring codes" },
      {
        name: "description",
        content:
          "Upload any file, get a short transfer code, share it with anyone. Files auto-expire in 10 minutes to 7 days. No account required.",
      },
      { property: "og:title", content: "HMX Share — Fast, secure file sharing" },
      {
        property: "og:description",
        content:
          "Send any file with a short transfer code. Auto-expiring, encrypted, and effortless.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            End-to-end encrypted transfers
          </span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-6xl md:text-7xl">
            Share files with a<br />
            <span className="gradient-text">6-character code.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Drop any file, get a transfer code, share it with anyone. Files self-destruct
            when the timer runs out.
          </p>
        </motion.div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-2">
          <ActionCard
            to="/upload"
            icon={<Upload className="h-7 w-7" />}
            title="Upload Files"
            description="Drag & drop, pick expiry, get a code."
            accent="from-[oklch(0.72_0.19_285)] to-[oklch(0.6_0.22_310)]"
            delay={0}
          />
          <ActionCard
            to="/download"
            icon={<Download className="h-7 w-7" />}
            title="Download Files"
            description="Enter a transfer code to retrieve."
            accent="from-[oklch(0.78_0.16_200)] to-[oklch(0.72_0.15_170)]"
            delay={0.05}
          />
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={<Zap />} title="Instant" text="Direct-to-storage uploads" />
          <Feature icon={<Shield />} title="Secure" text="Signed URLs, no leaks" />
          <Feature icon={<Clock />} title="Ephemeral" text="10 min to 7 days" />
          <Feature icon={<QrCode />} title="Shareable" text="Copy, QR, or link" />
        </div>
      </main>
      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        HMX Share · Anonymous transfers · No files stored beyond expiry
      </footer>
    </div>
  );
}

function ActionCard({
  to,
  icon,
  title,
  description,
  accent,
  delay,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      <Link
        to={to}
        className="group relative block overflow-hidden rounded-3xl glass p-8 shadow-[var(--shadow-card)] transition-all [touch-action:manipulation] active:scale-[0.98] hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-glow)]"
      >
        <div
          className={`absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-3xl transition-opacity group-hover:opacity-40`}
        />
        <div className="relative">
          <div
            className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${accent} text-primary-foreground shadow-lg`}
          >
            {icon}
          </div>
          <h3 className="mt-6 text-2xl font-bold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <div className="mt-6 inline-flex items-center text-sm font-medium text-primary">
            Continue
            <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl glass p-5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-primary">
        {icon}
      </div>
      <h4 className="mt-3 text-sm font-semibold">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
