import { lazy, Suspense, useState } from "react";
import {
  Copy,
  Link2,
  Share2,
  QrCode,
  Trash2,
  Settings2,
  Clock,
  FileIcon,
  DownloadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { formatBytes, formatRemaining, EXPIRY_OPTIONS } from "@/lib/format";
import { isExpired, shareLink, type TransferRow } from "@/lib/transfers";

const LazyQRCode = lazy(() =>
  import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
);

export function TransferCard({
  transfer,
  now,
  onDelete,
  onExtend,
}: {
  transfer: TransferRow;
  now: number;
  onDelete: (t: TransferRow) => void;
  onExtend: (t: TransferRow, ms: number) => void;
}) {
  const [showQR, setShowQR] = useState(false);
  const [manage, setManage] = useState(false);
  const expired = isExpired(transfer, now);
  const link = shareLink(transfer.transfer_code);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "HMX Share", text: transfer.transfer_code, url: link });
      } catch {
        /* dismissed */
      }
    } else {
      copy(link, "Link");
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileIcon className="h-4 w-4 shrink-0 text-primary" />
            <p className="truncate text-sm font-semibold">{transfer.file_name}</p>
          </div>
          <p className="mt-1 font-mono text-lg font-bold gradient-text">
            {transfer.transfer_code}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            expired
              ? "bg-destructive/15 text-destructive"
              : "bg-success/15 text-success"
          }`}
        >
          {expired ? "Expired" : "Active"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{transfer.file_count} file{transfer.file_count === 1 ? "" : "s"}</span>
        <span>{formatBytes(transfer.file_size)}</span>
        <span className="inline-flex items-center gap-1">
          <DownloadCloud className="h-3.5 w-3.5" /> {transfer.download_count} downloads
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {expired
            ? "Expired"
            : `Expires in ${formatRemaining(new Date(transfer.expires_at).getTime() - now)}`}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Action onClick={() => copy(transfer.transfer_code, "Code")} icon={<Copy className="h-3.5 w-3.5" />}>
          Copy Code
        </Action>
        <Action onClick={() => copy(link, "Link")} icon={<Link2 className="h-3.5 w-3.5" />}>
          Copy Link
        </Action>
        <Action onClick={share} icon={<Share2 className="h-3.5 w-3.5" />}>Share</Action>
        <Action onClick={() => setShowQR((v) => !v)} icon={<QrCode className="h-3.5 w-3.5" />}>
          QR Code
        </Action>
        <Action onClick={() => setManage((v) => !v)} icon={<Settings2 className="h-3.5 w-3.5" />}>
          Manage
        </Action>
        <Action
          onClick={() => onDelete(transfer)}
          icon={<Trash2 className="h-3.5 w-3.5" />}
          danger
        >
          Delete
        </Action>
      </div>

      {showQR && (
        <div className="mt-4 flex justify-center rounded-2xl bg-white p-4">
          <Suspense fallback={<div className="h-[148px] w-[148px] animate-pulse bg-muted" />}>
            <LazyQRCode value={link} size={148} />
          </Suspense>
        </div>
      )}

      {manage && (
        <div className="mt-4 space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-4 text-xs">
          <Row label="Transfer code" value={transfer.transfer_code} />
          <Row label="File / batch" value={transfer.file_name} />
          <Row label="Files" value={String(transfer.file_count)} />
          <Row label="Total size" value={formatBytes(transfer.file_size)} />
          <Row label="Created" value={new Date(transfer.created_at).toLocaleString()} />
          <Row label="Expires" value={new Date(transfer.expires_at).toLocaleString()} />
          <Row
            label="Remaining"
            value={expired ? "Expired" : formatRemaining(new Date(transfer.expires_at).getTime() - now)}
          />
          <Row label="Downloads" value={`${transfer.download_count} (unlimited until expiry)`} />
          <Row label="Status" value={expired ? "Expired" : "Active"} />

          <div>
            <p className="mb-2 font-medium text-muted-foreground">Extend expiry</p>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => onExtend(transfer, o.value)}
                  className="rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px] transition-colors hover:bg-muted"
                >
                  +{o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right font-medium">{value}</span>
    </div>
  );
}

function Action({
  onClick,
  icon,
  children,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors [touch-action:manipulation] active:scale-95 ${
        danger
          ? "border-destructive/40 text-destructive hover:bg-destructive/10"
          : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
