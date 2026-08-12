import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { TransferCard } from "@/components/TransferCard";
import { useAuth } from "@/hooks/use-auth";
import { deleteTransfer, extendExpiry, fetchMyTransfers, isExpired } from "@/lib/transfers";

export const Route = createFileRoute("/_authenticated/transfers")({
  head: () => ({
    meta: [
      { title: "My Transfers — HMX Share" },
      { name: "description", content: "Manage your HMX Share transfers: copy codes, share links, QR codes, extend expiry or delete." },
      { property: "og:title", content: "My Transfers — HMX Share" },
      { property: "og:description", content: "All your active and expired HMX transfers in one place." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TransfersPage,
});

type Tab = "active" | "expired" | "all";

function TransfersPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("active");
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

  const list = useMemo(() => {
    if (tab === "all") return transfers;
    return transfers.filter((t) => (tab === "active" ? !isExpired(t, now) : isExpired(t, now)));
  }, [transfers, tab, now]);

  return (
    <AppShell>
      <PageHeader title="My Transfers" subtitle="Every transfer you've created while signed in." />

      <div className="mb-5 inline-flex rounded-xl border border-border/60 bg-muted/20 p-1 text-sm">
        {(["active", "expired", "all"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 capitalize transition-colors ${
              tab === t ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl glass p-8 text-center text-sm text-muted-foreground">
          Nothing here yet.{" "}
          <Link to="/upload" className="text-primary hover:underline">
            Upload a file
          </Link>
          .
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((t) => (
            <TransferCard
              key={t.id}
              transfer={t}
              now={now}
              onDelete={async (tr) => {
                if (!window.confirm(`Delete transfer ${tr.transfer_code}? This cannot be undone.`))
                  return;
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
    </AppShell>
  );
}
