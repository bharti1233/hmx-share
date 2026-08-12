import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, LayoutDashboard, Send, DownloadCloud, Settings } from "lucide-react";
import { Nav } from "@/components/Nav";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transfers", label: "Transfers", icon: Send },
  { to: "/downloads", label: "Downloads", icon: DownloadCloud },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Nav />
      <div className="mx-auto hidden max-w-6xl gap-1 px-4 pt-4 text-sm md:flex sm:px-6">
        {items.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            activeProps={{ className: "rounded-lg px-3 py-1.5 bg-muted text-foreground" }}
            activeOptions={{ exact: to === "/" }}
          >
            {label}
          </Link>
        ))}
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 glass md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] text-muted-foreground transition-colors [touch-action:manipulation] active:scale-95"
              activeProps={{
                className:
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] text-primary",
              }}
              activeOptions={{ exact: to === "/" }}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
