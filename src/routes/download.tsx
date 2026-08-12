import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Download as DownloadIcon, FileIcon, Clock, Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes, formatRemaining } from "@/lib/format";

interface Transfer {
  id: string;
  transfer_code: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  storage_path: string;
  created_at: string;
  expires_at: string;
  download_count: number;
  file_count?: number;
}


export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download — HMX Share" },
      { name: "description", content: "Enter a transfer code to download the shared file." },
      { property: "og:title", content: "Download — HMX Share" },
      { property: "og:description", content: "Enter a transfer code to download the file." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  component: DownloadPage,
});

function normalizeCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (cleaned.startsWith("HMX-")) return cleaned;
  if (/^[A-Z0-9]{6}$/.test(cleaned)) return `HMX-${cleaned}`;
  return cleaned;
}

function DownloadPage() {
  const { code: initialCode } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState(initialCode ?? "");
  const [loading, setLoading] = useState(false);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (initialCode) lookup(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookup = async (raw: string) => {
    const c = normalizeCode(raw);
    if (!c) return;
    setLoading(true);
    setError(null);
    setTransfer(null);
    try {
      const { data, error: err } = await supabase
        .from("transfers")
        .select("*")
        .eq("transfer_code", c)
        .maybeSingle();
      if (err) throw new Error(err.message);
      if (!data) {
        setError("Invalid or expired transfer code.");
        return;
      }
      setTransfer(data as Transfer);
      navigate({ to: "/download", search: { code: c }, replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const startDownload = async () => {
    if (!transfer) return;
    setDownloading(true);
    try {
      const { data, error: sigErr } = await supabase.storage
        .from("transfers")
        .createSignedUrl(transfer.storage_path, 60, { download: transfer.file_name });
      if (sigErr || !data?.signedUrl) throw new Error(sigErr?.message ?? "Could not sign download");

      // Best-effort download count increment
      supabase
        .from("transfers")
        .update({ download_count: transfer.download_count + 1 })
        .eq("id", transfer.id)
        .then(() => {});

      if (user) {
        supabase
          .from("download_history")
          .insert({
            user_id: user.id,
            
            transfer_code: transfer.transfer_code,
            file_name: transfer.file_name,
            file_size: transfer.file_size,
            file_count: transfer.file_count ?? 1,
          })
          .then(() => {});
      }



      window.location.href = data.signedUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const msLeft = transfer ? new Date(transfer.expires_at).getTime() - now : 0;
  const expired = transfer && msLeft <= 0;

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold sm:text-4xl">
          Enter a <span className="gradient-text">transfer code</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Codes look like <span className="font-mono">HMX-8D4KQ2</span>.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(code);
          }}
          className="mt-8 rounded-2xl glass p-2 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-2">
            <div className="pl-3 text-muted-foreground">
              <Search className="h-5 w-5" />
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="HMX-XXXXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="w-full min-w-0 bg-transparent py-3 font-mono text-lg tracking-widest outline-none placeholder:text-muted-foreground/50"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="shrink-0 rounded-xl gradient-bg px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {loading ? "…" : "Find"}
            </button>
          </div>
        </form>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Not found</p>
              <p className="text-destructive/80">{error}</p>
            </div>
          </motion.div>
        )}

        {transfer && !expired && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-3xl glass p-6 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-bg text-primary-foreground shadow-[var(--shadow-glow)]">
                <FileIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{transfer.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(transfer.file_size)} · {transfer.file_type || "file"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <Meta label="Uploaded" value={new Date(transfer.created_at).toLocaleString()} />
              <Meta
                label="Expires in"
                value={formatRemaining(msLeft)}
                accent
              />
            </div>

            <button
              onClick={startDownload}
              disabled={downloading}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl gradient-bg py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <DownloadIcon className="h-5 w-5" />
              {downloading ? "Preparing…" : "Download file"}
            </button>
          </motion.div>
        )}

        {expired && (
          <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm">
            <p className="font-semibold text-destructive">This transfer has expired.</p>
            <p className="mt-1 text-destructive/80">
              Ask the sender to upload it again.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 font-mono text-sm ${accent ? "text-primary" : "text-foreground"} flex items-center gap-1`}
      >
        {accent && <Clock className="h-3 w-3" />}
        {value}
      </p>
    </div>
  );
}
