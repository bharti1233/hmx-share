import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload as UploadIcon,
  FileIcon,
  X,
  Check,
  Copy,
  Share2,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Nav } from "@/components/Nav";
import { supabase } from "@/integrations/supabase/client";
import { EXPIRY_OPTIONS, formatBytes, formatDuration, formatRemaining, formatSpeed } from "@/lib/format";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload — HMX Share" },
      { name: "description", content: "Upload a file and get a transfer code to share." },
      { property: "og:title", content: "Upload — HMX Share" },
      { property: "og:description", content: "Upload a file and get a transfer code." },
    ],
  }),
  component: UploadPage,
});

type Phase = "idle" | "picked" | "uploading" | "done" | "error";

interface Result {
  code: string;
  fileName: string;
  fileSize: number;
  expiresAt: string;
}

const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState<number>(EXPIRY_OPTIONS[2].value); // 1h default
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_SIZE) {
      toast.error(`File exceeds ${formatBytes(MAX_SIZE)} limit`);
      return;
    }
    setFile(f);
    setPhase("picked");
    setError(null);
    setProgress(0);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const cancelUpload = () => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    setPhase("picked");
    setProgress(0);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setPhase("idle");
    setProgress(0);
    setError(null);
  };

  const startUpload = async () => {
    if (!file) return;
    setPhase("uploading");
    setError(null);

    try {
      // 1. Get a unique transfer code from the DB
      const { data: codeData, error: codeErr } = await supabase.rpc("generate_transfer_code");
      if (codeErr || !codeData) throw new Error(codeErr?.message ?? "Could not generate code");
      const code = codeData as string;
      const storagePath = `${code}/${file.name}`;

      // 2. Upload directly to Storage using signed upload URL, tracking progress via XHR
      const { data: signed, error: signedErr } = await supabase.storage
        .from("transfers")
        .createSignedUploadUrl(storagePath);
      if (signedErr || !signed) throw new Error(signedErr?.message ?? "Could not sign upload");

      const startTime = Date.now();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", signed.signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return;
          const pct = (ev.loaded / ev.total) * 100;
          const elapsed = (Date.now() - startTime) / 1000;
          const bps = ev.loaded / Math.max(elapsed, 0.001);
          setProgress(pct);
          setSpeed(bps);
          setRemaining((ev.total - ev.loaded) / Math.max(bps, 1));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.onabort = () => reject(new Error("Upload cancelled"));
        xhr.send(file);
      });

      // 3. Insert row into transfers
      const expiresAt = new Date(Date.now() + expiry).toISOString();
      const { error: insertErr } = await supabase.from("transfers").insert({
        transfer_code: code,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
        storage_path: storagePath,
        expires_at: expiresAt,
      });
      if (insertErr) throw new Error(insertErr.message);

      setResult({ code, fileName: file.name, fileSize: file.size, expiresAt });
      setPhase("done");
      toast.success("Upload complete!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      if (msg !== "Upload cancelled") {
        setError(msg);
        setPhase("error");
        toast.error(msg);
      }
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-14">
        <AnimatePresence mode="wait">
          {phase === "done" && result ? (
            <ResultView key="done" result={result} onReset={reset} />
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <h1 className="text-3xl font-bold sm:text-4xl">
                Upload a <span className="gradient-text">file</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Any file type, up to {formatBytes(MAX_SIZE)}.
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !file && inputRef.current?.click()}
                className={`mt-8 cursor-pointer rounded-3xl glass p-8 text-center transition-all sm:p-12 ${
                  dragging ? "border-primary/60 bg-primary/5" : ""
                } ${file ? "cursor-default" : "hover:border-primary/40"}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                {!file ? (
                  <>
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl gradient-bg shadow-[var(--shadow-glow)]">
                      <UploadIcon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">Drop file here</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      or click to browse
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-4 text-left">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted">
                      <FileIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    {phase !== "uploading" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          reset();
                        }}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {file && phase !== "uploading" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 rounded-2xl glass p-5"
                >
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-primary" /> Expires after
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {EXPIRY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setExpiry(opt.value)}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${
                          expiry === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {phase === "uploading" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rounded-2xl glass p-5"
                >
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">Uploading…</span>
                    <span className="font-mono tabular-nums text-primary">
                      {progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full gradient-bg"
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "linear", duration: 0.15 }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>{formatSpeed(speed)}</span>
                    <span>{formatDuration(remaining)} remaining</span>
                  </div>
                  <button
                    onClick={cancelUpload}
                    className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                  >
                    Cancel upload
                  </button>
                </motion.div>
              )}

              {error && phase === "error" && (
                <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              {file && phase !== "uploading" && (
                <button
                  onClick={startUpload}
                  className="mt-6 w-full rounded-2xl gradient-bg py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  {phase === "error" ? "Try again" : "Upload & generate code"}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function ResultView({ result, onReset }: { result: Result; onReset: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const msLeft = new Date(result.expiresAt).getTime() - now;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/download?code=${result.code}`
      : "";

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "HMX Share",
          text: `File "${result.fileName}" — code ${result.code}`,
          url: shareUrl,
        });
      } catch {
        /* dismissed */
      }
    } else {
      copy(shareUrl, "Link");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-success/15">
          <Check className="h-5 w-5 text-success" />
        </div>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">File is ready to share</h1>
          <p className="text-sm text-muted-foreground">Send this code to your recipient.</p>
        </div>
      </div>

      <div className="mt-8 rounded-3xl glass p-6 sm:p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Transfer code
        </p>
        <p className="mt-3 font-mono text-3xl font-bold tracking-widest sm:text-5xl gradient-text">
          {result.code}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => copy(result.code, "Code")}
            className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-medium hover:bg-muted/70"
          >
            <Copy className="h-4 w-4" /> Copy code
          </button>
          <button
            onClick={() => copy(shareUrl, "Link")}
            className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-medium hover:bg-muted/70"
          >
            <Copy className="h-4 w-4" /> Copy link
          </button>
          <button
            onClick={share}
            className="inline-flex items-center gap-2 rounded-xl gradient-bg px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        <div className="mx-auto mt-8 w-fit rounded-2xl bg-white p-3">
          <QRCodeSVG value={shareUrl} size={144} level="M" />
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Expires in</span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {formatRemaining(msLeft)}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl glass p-4 text-sm">
        <div className="flex items-center gap-3">
          <FileIcon className="h-4 w-4 text-primary" />
          <span className="truncate flex-1">{result.fileName}</span>
          <span className="text-muted-foreground shrink-0">
            {formatBytes(result.fileSize)}
          </span>
        </div>
      </div>

      <button
        onClick={onReset}
        className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Upload another file
      </button>
    </motion.div>
  );
}
