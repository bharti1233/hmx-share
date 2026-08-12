import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trash2, FileIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes } from "@/lib/format";
import { fetchMyDownloads } from "@/lib/transfers";

export const Route = createFileRoute("/_authenticated/downloads")({
  head: () => ({
    meta: [
      { title: "My Downloads — HMX Share" },
      { name: "description", content: "History of the transfers you downloaded with HMX Share." },
      { property: "og:title", content: "My Downloads — HMX Share" },
      { property: "og:description", content: "Review and clear your HMX Share download history." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DownloadsPage,
});

function DownloadsPage() {
  const { user } = useAuth();
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["my-downloads", user?.id],
    queryFn: () => fetchMyDownloads(user!.id),
    enabled: !!user,
  });

  const clearAll = async () => {
    if (!user) return;
    if (!window.confirm("Clear your entire download history?")) return;
    const { error } = await supabase.from("download_history").delete().eq("user_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("History cleared");
    refetch();
  };

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="My Downloads" subtitle="Transfers you've downloaded while signed in." />
        {rows.length > 0 && (
          <button
            onClick={clearAll}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear history
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl glass p-8 text-center text-sm text-muted-foreground">
          No downloads yet.{" "}
          <Link to="/download" search={{ code: undefined }} className="text-primary hover:underline">
            Enter a transfer code
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl glass p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                <FileIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.file_name}</p>
                <p className="font-mono text-xs text-primary">{r.transfer_code}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.file_count} file{r.file_count === 1 ? "" : "s"} · {formatBytes(r.file_size)} ·{" "}
                  {new Date(r.downloaded_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
