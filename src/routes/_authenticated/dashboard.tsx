import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Upload, Download, Send, DownloadCloud, HardDrive, Activity } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { TransferCard } from "@/components/TransferCard";
import { useAuth } from "@/hooks/use-auth";
import { formatBytes } from "@/lib/format";
import { fetchMyTransfers, isExpired, deleteTransfer, extendExpiry } from "@/lib/transfers";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — HMX Share" },
      { name: "description", content: "Your HMX Share dashboard: active transfers, downloads, storage used and recent activity." },
      { property: "og:title", content: "Dashboard — HMX Share" },
      { property: "og:description", content: "Track your HMX Share transfers and downloads." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, displayName } = useAuth();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: transfers = [], isLoading, refetch } = useQuery({
    queryKey: ["my-transfers", user?.id],
    queryFn: () => fetchMyTransfers(user!.id),
    enabled: !!user,
  });

  const active = transfers.filter((t) => !isExpired(t, now));
  const totalDownloads = transfers.reduce((s, t) => s + t.download_count, 0);
  const storage = active.reduce((s, t) => s + t.file_size, 0);

  return (
    <AppShell>
      <PageHeader title="Dashboard" subtitle={`Hi, ${displayName} — here's your activity.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Activity />} label="Active Transfers" value={String(active.length)} />
        <Stat icon={<DownloadCloud />} label="Total Downloads" value={String(totalDownloads)} />
        <Stat icon={<Send />} label="Total Uploads" value={String(transfers.length)} />
        <Stat icon={<HardDrive />} label="Storage Used" value={formatBytes(storage)} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <QuickAction to="/upload" icon={<Upload className="h-5 w-5" />} label="Upload Files" />
        <QuickAction
          to="/download"
          icon={<Download className="h-5 w-5" />}
          label="Download Files"
          search
        />
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent Transfers</h2>
          <Link to="/transfers" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/40" />
            ))}
          </div>
        ) : transfers.length === 0 ? (
          <div className="rounded-2xl glass p-8 text-center text-sm text-muted-foreground">
            No transfers yet.{" "}
            <Link to="/upload" className="text-primary hover:underline">
              Upload your first file
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {transfers.slice(0, 4).map((t) => (
              <TransferCard
                key={t.id}
                transfer={t}
                now={now}
                onDelete={async (tr) => {
                  try {
                    await deleteTransfer(tr);
                    toast.success("Transfer deleted");
                    refetch();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Delete failed");
                  }
                }}
                onExtend={async (tr, ms) => {
                  try {
                    await extendExpiry(tr, ms);
                    toast.success("Expiry extended");
                    refetch();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not extend");
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl glass p-4">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-primary">{icon}</div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function QuickAction({
  to,
  icon,
  label,
  search,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  search?: boolean;
}) {
  return (
    <Link
      to={to}
      {...(search ? { search: { code: undefined } } : {})}
      className="flex items-center gap-3 rounded-2xl glass p-5 transition-all [touch-action:manipulation] hover:border-primary/40 active:scale-[0.98]"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[oklch(0.72_0.19_285)] to-[oklch(0.78_0.16_200)] text-primary-foreground">
        {icon}
      </span>
      <span className="font-semibold">{label}</span>
    </Link>
  );
}
