import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, User as UserIcon, LayoutDashboard, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQueryClient } from "@tanstack/react-query";

const linkCls =
  "rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const activeCls = { className: "rounded-lg px-3 py-2 text-foreground bg-muted" };

export function Nav() {
  const { user, displayName, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    setOpen(false);
    navigate({ to: "/", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src="/hmx-logo.png"
            alt="HMX Share"
            className="h-9 w-auto rounded-xl object-contain transition-transform group-hover:scale-105"
          />
        </Link>

        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link to="/upload" className={linkCls} activeProps={activeCls}>
            Upload
          </Link>
          <Link
            to="/download"
            search={{ code: undefined }}
            className={linkCls}
            activeProps={activeCls}
          >
            Download
          </Link>

          <ThemeToggle />
          {!loading && !user && (
            <Link
              to="/signin"
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[oklch(0.72_0.19_285)] to-[oklch(0.78_0.16_200)] px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg transition-transform [touch-action:manipulation] active:scale-95 sm:text-sm"
            >
              <UserIcon className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">Sign In</span>
            </Link>
          )}

          {!loading && user && (
            <div className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Account menu"
                className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-2 text-xs font-semibold transition-colors hover:bg-muted sm:text-sm"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[oklch(0.72_0.19_285)] to-[oklch(0.78_0.16_200)] text-[11px] font-bold text-primary-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[7rem] truncate sm:inline">{displayName}</span>
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>

              {open && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-border/60 glass p-1.5 shadow-xl">
                    <MenuLink to="/dashboard" onClick={() => setOpen(false)}>
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </MenuLink>
                    <MenuLink to="/transfers" onClick={() => setOpen(false)}>
                      My Transfers
                    </MenuLink>
                    <MenuLink to="/downloads" onClick={() => setOpen(false)}>
                      Downloads
                    </MenuLink>
                    <MenuLink to="/profile" onClick={() => setOpen(false)}>
                      Profile
                    </MenuLink>
                    <MenuLink to="/settings" onClick={() => setOpen(false)}>
                      Settings
                    </MenuLink>
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

function MenuLink({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      activeProps={{
        className: "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground bg-muted",
      }}
    >
      {children}
    </Link>
  );
}
