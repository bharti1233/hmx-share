import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — HMX Share" },
      { name: "description", content: "Update your HMX Share display name, change your password, and manage your account." },
      { property: "og:title", content: "Account Settings — HMX Share" },
      { property: "og:description", content: "Manage your HMX Share profile and password." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    setName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  const saveName = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("Display name can't be empty");
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", user.id);
    setSavingName(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile updated");
  };

  const savePassword = async () => {
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPw(false);
    if (error) return toast.error(error.message);
    setPassword("");
    setConfirm("");
    toast.success("Password updated");
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/signin", replace: true });
  };

  return (
    <AppShell>
      <PageHeader title="Account Settings" subtitle="Manage your profile and security." />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl glass p-6">
          <h2 className="text-lg font-bold">Profile</h2>
          <div className="mt-4 space-y-4">
            <Field label="Email">
              <input
                value={user?.email ?? ""}
                disabled
                className="w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground"
              />
            </Field>
            <Field label="Display name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </Field>
            <button
              onClick={saveName}
              disabled={savingName}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savingName ? "Saving…" : "Save changes"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl glass p-6">
          <h2 className="text-lg font-bold">Change password</h2>
          <div className="mt-4 space-y-4">
            <Field label="New password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </Field>
            <button
              onClick={savePassword}
              disabled={savingPw}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savingPw ? "Updating…" : "Update password"}
            </button>
          </div>
        </section>
      </div>

      <button
        onClick={signOut}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
