import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload as UploadIcon,
  FileIcon,
  X,
  Check,
  Copy,
  Share2,
  Clock,
  ArrowLeft,
  FolderIcon,
  Package,
  AlertCircle,
} from "lucide-react";
// qrcode.react is loaded lazily to keep the initial bundle lean.
const LazyQRCode = lazy(() =>
  import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
);
import { toast } from "sonner";
import { Nav } from "@/components/Nav";
import { FileTree } from "@/components/FileTree";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPIRY_OPTIONS,
  formatBytes,
  formatDuration,
  formatRemaining,
  formatSpeed,
} from "@/lib/format";
import {
  buildTree,
  commonRoot,
  countFolders,
  normalizeRelPath,
} from "@/lib/folder-transfer";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload — HMX Share" },
      { name: "description", content: "Upload files or entire folders and get a transfer code to share." },
      { property: "og:title", content: "Upload — HMX Share" },
      { property: "og:description", content: "Upload files or entire folders and get a transfer code." },
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

interface PickedItem {
  file: File;
  relPath: string; // path inside a dropped folder, or just the file name
}

const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

// Walk a DataTransferItem tree (files + folders) into a flat list with relative paths.
async function readEntries(entry: any, path = ""): Promise<PickedItem[]> {
  if (!entry) return [];
  if (entry.isFile) {
    const file: File = await new Promise((res, rej) => entry.file(res, rej));
    return [{ file, relPath: path + file.name }];
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const items: PickedItem[] = [];
    // readEntries returns in batches — keep reading until empty
    while (true) {
      const batch: any[] = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const child of batch) {
        items.push(...(await readEntries(child, path + entry.name + "/")));
      }
    }
    return items;
  }
  return [];
}

async function collectFromDataTransfer(dt: DataTransfer): Promise<PickedItem[]> {
  const items = dt.items;
  const out: PickedItem[] = [];
  if (items && items.length) {
    const entries: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const entry = (it as any).webkitGetAsEntry?.();
      if (entry) entries.push(entry);
      else {
        const f = it.getAsFile?.();
        if (f) out.push({ file: f, relPath: f.name });
      }
    }
    for (const e of entries) out.push(...(await readEntries(e)));
  } else {
    for (const f of Array.from(dt.files)) out.push({ file: f, relPath: f.name });
  }
  return out;
}

function putBlob(
  url: string,
  blob: Blob,
  type: string,
  onProgress: (loaded: number) => void,
  register: (xhr: XMLHttpRequest | null) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(ev.loaded);
    };
    xhr.onload = () => {
      register(null);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => {
      register(null);
      reject(new Error("Network error"));
    };
    xhr.onabort = () => {
      register(null);
      reject(new Error("Upload cancelled"));
    };
    xhr.send(blob);
  });
}

function UploadPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PickedItem[]>([]);
  const [expiry, setExpiry] = useState<number>(EXPIRY_OPTIONS[2].value);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [currentPct, setCurrentPct] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);
  const [folderSupported, setFolderSupported] = useState(true);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = document.createElement("input");
    setFolderSupported("webkitdirectory" in el);
  }, []);

  const totalSize = items.reduce((s, it) => s + it.file.size, 0);
  const isBundle = items.length > 1 || (items.length === 1 && items[0].relPath.includes("/"));
  const paths = useMemo(() => items.map((it) => normalizeRelPath(it.relPath)), [items]);
  const root = useMemo(() => commonRoot(paths), [paths]);
  const folderCount = useMemo(() => countFolders(paths), [paths]);
  const tree = useMemo(
    () => buildTree(items.map((it, i) => ({ path: paths[i], size: it.file.size }))),
    [items, paths],
  );
  const bundleName = `${root || "hmx-bundle"}.zip`;

  const setPicked = (list: PickedItem[]) => {
    if (!list.length) {
      toast.error("That folder is empty — nothing to upload");
      return;
    }
    const total = list.reduce((s, it) => s + it.file.size, 0);
    if (total > MAX_SIZE) {
      toast.error(`Selection exceeds ${formatBytes(MAX_SIZE)} limit`);
      return;
    }
    setItems(list);
    setPhase("picked");
    setError(null);
    setProgress(0);
  };

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    try {
      const picked = await collectFromDataTransfer(e.dataTransfer);
      setPicked(picked);
    } catch {
      toast.error("Could not read dropped items");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFilesPicked = (files: FileList | null) => {
    if (!files) return;
    const list: PickedItem[] = Array.from(files).map((f) => ({
      file: f,
      // <input webkitdirectory> exposes relative path
      relPath: (f as any).webkitRelativePath || f.name,
    }));
    setPicked(list);
  };

  const cancelUpload = () => {
    cancelledRef.current = true;
    xhrRef.current?.abort();
    xhrRef.current = null;
    setPhase("picked");
    setProgress(0);
  };

  const reset = () => {
    setItems([]);
    setResult(null);
    setPhase("idle");
    setProgress(0);
    setUploadedBytes(0);
    setCurrentFile("");
    setCurrentPct(0);
    setCompleted(0);
    setFailed(0);
    setError(null);
  };

  const startUpload = async () => {
    if (!items.length) return;
    setError(null);
    cancelledRef.current = false;
    setCompleted(0);
    setFailed(0);
    setUploadedBytes(0);
    setProgress(0);

    try {
      const { data: codeData, error: codeErr } = await supabase.rpc("generate_transfer_code");
      if (codeErr || !codeData) throw new Error(codeErr?.message ?? "Could not generate code");
      const code = codeData as string;
      setPhase("uploading");
      const startTime = Date.now();

      if (!isBundle) {
        // ---- single loose file: unchanged behaviour ----
        const f = items[0].file;
        const type = f.type || "application/octet-stream";
        const storagePath = `${code}/${f.name}`;
        const { data: signed, error: signedErr } = await supabase.storage
          .from("transfers")
          .createSignedUploadUrl(storagePath);
        if (signedErr || !signed) throw new Error(signedErr?.message ?? "Could not sign upload");
        setCurrentFile(f.name);
        await putBlob(
          signed.signedUrl,
          f,
          type,
          (loaded) => {
            const pct = (loaded / Math.max(f.size, 1)) * 100;
            const elapsed = (Date.now() - startTime) / 1000;
            const bps = loaded / Math.max(elapsed, 0.001);
            setProgress(pct);
            setCurrentPct(pct);
            setUploadedBytes(loaded);
            setSpeed(bps);
            setRemaining((f.size - loaded) / Math.max(bps, 1));
          },
          (x) => (xhrRef.current = x),
        );
        setCompleted(1);

        const expiresAt = new Date(Date.now() + expiry).toISOString();
        const { error: insertErr } = await supabase.from("transfers").insert({
          transfer_code: code,
          file_name: f.name,
          file_size: f.size,
          file_type: type,
          storage_path: storagePath,
          expires_at: expiresAt,
          user_id: user?.id ?? null,
          file_count: 1,
        });
        if (insertErr) throw new Error(insertErr.message);
        setResult({ code, fileName: f.name, fileSize: f.size, expiresAt });
        setPhase("done");
        toast.success("Upload complete!");
        return;
      }

      // ---- folder / multi-file: create and upload the actual ZIP archive ----
      setCurrentFile(bundleName);
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      items.forEach((it, i) => {
        const rel = paths[i];
        if (rel) zip.file(rel, it.file);
      });

      const zipBlob = await zip.generateAsync(
        {
          type: "blob",
          mimeType: "application/zip",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        },
        (metadata) => {
          if (cancelledRef.current) return;
          const pct = Math.min(metadata.percent, 100);
          setCurrentFile(metadata.currentFile || bundleName);
          setCurrentPct(pct);
          setProgress(pct * 0.2);
          setUploadedBytes(Math.round((pct / 100) * totalSize * 0.2));
        },
      );
      if (cancelledRef.current) throw new Error("Upload cancelled");
      if (zipBlob.size === 0) throw new Error("Could not create ZIP archive");

      const storagePath = `${code}/${bundleName}`;
      const { data: signed, error: signedErr } = await supabase.storage
        .from("transfers")
        .createSignedUploadUrl(storagePath, { upsert: true });
      if (signedErr || !signed) throw new Error(signedErr?.message ?? "Could not sign upload");
      await putBlob(
        signed.signedUrl,
        zipBlob,
        "application/zip",
        (loaded) => {
          const pct = (loaded / Math.max(zipBlob.size, 1)) * 100;
          const elapsed = (Date.now() - startTime) / 1000;
          const bps = loaded / Math.max(elapsed, 0.001);
          setProgress(20 + pct * 0.8);
          setCurrentPct(pct);
          setUploadedBytes(Math.min(totalSize, Math.round(totalSize * 0.2 + totalSize * 0.8 * (pct / 100))));
          setSpeed(bps);
          setRemaining((zipBlob.size - loaded) / Math.max(bps, 1));
        },
        (x) => (xhrRef.current = x),
      );
      setCompleted(items.length);

      const expiresAt = new Date(Date.now() + expiry).toISOString();
      const { error: insertErr } = await supabase.from("transfers").insert({
        transfer_code: code,
        file_name: bundleName,
        file_size: zipBlob.size,
        file_type: "application/zip",
        storage_path: storagePath,
        expires_at: expiresAt,
        user_id: user?.id ?? null,
        file_count: items.length,
      });
      if (insertErr) throw new Error(insertErr.message);

      setResult({ code, fileName: bundleName, fileSize: zipBlob.size, expiresAt });
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

  const busy = phase === "uploading";

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
                Upload <span className="gradient-text">anything</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Drop files or entire folders — any type, up to {formatBytes(MAX_SIZE)}.
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !items.length && inputRef.current?.click()}
                className={`mt-8 rounded-3xl glass p-8 text-center transition-all sm:p-12 ${
                  dragging ? "border-primary/60 bg-primary/5 scale-[1.01]" : ""
                } ${items.length ? "cursor-default" : "cursor-pointer hover:border-primary/40"}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => onFilesPicked(e.target.files)}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  className="hidden"
                  // @ts-expect-error non-standard attributes for folder picking
                  webkitdirectory=""
                  directory=""
                  mozdirectory=""
                  multiple
                  onChange={(e) => onFilesPicked(e.target.files)}
                />
                {!items.length ? (
                  <>
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl gradient-bg shadow-[var(--shadow-glow)]">
                      <UploadIcon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">Drop files or folders here</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Any file type, single or multiple, nested folders — structure is preserved
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          inputRef.current?.click();
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/70"
                      >
                        <FileIcon className="h-4 w-4" /> Choose files
                      </button>
                      {folderSupported && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            folderInputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/70"
                        >
                          <FolderIcon className="h-4 w-4" /> Choose folder
                        </button>
                      )}
                    </div>
                    {!folderSupported && (
                      <div className="mx-auto mt-5 flex max-w-md items-start gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-left text-xs text-muted-foreground">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          Your browser doesn&apos;t support folder upload. Please select the files
                          inside the folder or use a supported desktop browser.
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-left">
                    <div className="flex items-center gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted">
                        {isBundle ? (
                          root ? (
                            <FolderIcon className="h-5 w-5 text-primary" />
                          ) : (
                            <Package className="h-5 w-5 text-primary" />
                          )
                        ) : (
                          <FileIcon className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {isBundle ? root || `${items.length} items` : items[0].file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isBundle
                            ? `${items.length} files · ${folderCount} folders · ${formatBytes(totalSize)}`
                            : formatBytes(totalSize)}
                        </p>
                      </div>
                      {!busy && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            reset();
                          }}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Clear selection"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {isBundle && !busy && (
                      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                        <FileTree nodes={tree} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {items.length > 0 && !busy && (
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

              {busy && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rounded-2xl glass p-5"
                >
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="truncate font-medium">
                      Uploading {isBundle ? root || `${items.length} items` : items[0]?.file.name}
                    </span>
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
                    <span>
                      {formatBytes(uploadedBytes)} / {formatBytes(totalSize)}
                    </span>
                    <span>
                      {completed} / {items.length} files
                      {failed > 0 && <span className="text-destructive"> · {failed} failed</span>}
                    </span>
                  </div>

                  {isBundle && currentFile && (
                    <div className="mt-4 rounded-xl bg-background/40 p-3">
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {currentFile}
                      </p>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-[width] duration-150"
                          style={{ width: `${currentPct}%` }}
                        />
                      </div>
                    </div>
                  )}

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

              {items.length > 0 && !busy && (
                <button
                  onClick={startUpload}
                  className="mt-6 w-full rounded-2xl gradient-bg py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  {phase === "error"
                    ? "Try again"
                    : isBundle
                    ? `Upload ${items.length} files`
                    : "Upload & generate code"}
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

        <div className="mx-auto mt-8 w-fit rounded-2xl bg-white p-3" style={{ minHeight: 168, minWidth: 168 }}>
          <Suspense fallback={<div className="h-[144px] w-[144px] animate-pulse rounded bg-muted" />}>
            <LazyQRCode value={shareUrl} size={144} level="M" />
          </Suspense>
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
