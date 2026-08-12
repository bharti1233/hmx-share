import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell, fieldCls, primaryBtnCls } from "@/components/AuthShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — HMX Share" },
      { name: "description", content: "Request a password reset link for your HMX Share account." },
      { property: "og:title", content: "Reset Password — HMX Share" },
      { property: "og:description", content: "Recover access to your HMX Share account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setSent(true);
  };

  return (
    <AuthShell
      title={<>Forgot <span className="gradient-text">password?</span></>}
      subtitle="We'll email you a secure reset link."
      footer={
        <Link to="/signin" className="font-semibold text-primary hover:underline">
          Back to Sign In
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4 text-sm text-muted-foreground">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[oklch(0.72_0.19_285)] to-[oklch(0.78_0.16_200)] text-primary-foreground">
            <MailCheck className="h-7 w-7" />
          </div>
          <p>
            If an account exists for{" "}
            <span className="font-semibold text-foreground">{email}</span>, a reset link is on its
            way.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={fieldCls}
            />
          </div>
          {error && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </span>
            ) : (
              "Send reset link"
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
