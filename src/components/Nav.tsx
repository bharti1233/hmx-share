import { Link } from "@tanstack/react-router";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-bg shadow-[var(--shadow-glow)] transition-transform group-hover:scale-105">
            <span className="text-sm font-bold text-primary-foreground">H</span>
          </div>
          <span className="text-lg font-bold tracking-tight">
            HMX <span className="gradient-text">Share</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm">
          <Link
            to="/upload"
            className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            activeProps={{ className: "rounded-lg px-3 py-2 text-foreground bg-muted" }}
          >
            Upload
          </Link>
          <Link
            to="/download"
            className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            activeProps={{ className: "rounded-lg px-3 py-2 text-foreground bg-muted" }}
          >
            Download
          </Link>
        </nav>
      </div>
    </header>
  );
}
