import { supabase } from "@/integrations/supabase/client";

export interface TransferRow {
  id: string;
  transfer_code: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  storage_path: string;
  created_at: string;
  expires_at: string;
  download_count: number;
  status: string;
  file_count: number;
  user_id: string | null;
}

export function isExpired(t: TransferRow, now = Date.now()) {
  return new Date(t.expires_at).getTime() <= now;
}

export async function fetchMyTransfers(userId: string): Promise<TransferRow[]> {
  const { data, error } = await supabase
    .from("transfers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TransferRow[];
}

export async function deleteTransfer(t: TransferRow) {
  await supabase.storage.from("transfers").remove([t.storage_path]);
  const { error } = await supabase.from("transfers").delete().eq("id", t.id);
  if (error) throw new Error(error.message);
}

export async function extendExpiry(t: TransferRow, addMs: number) {
  const base = Math.max(Date.now(), new Date(t.expires_at).getTime());
  const next = new Date(base + addMs).toISOString();
  const { error } = await supabase
    .from("transfers")
    .update({ expires_at: next, status: "active" })
    .eq("id", t.id);
  if (error) throw new Error(error.message);
  return next;
}

export function shareLink(code: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/download?code=${encodeURIComponent(code)}`;
}

export interface DownloadRow {
  id: string;
  transfer_code: string;
  file_name: string;
  file_size: number;
  file_count: number;
  downloaded_at: string;
}

export async function fetchMyDownloads(userId: string): Promise<DownloadRow[]> {
  const { data, error } = await supabase
    .from("download_history")
    .select("id, transfer_code, file_name, file_size, file_count, downloaded_at")
    .eq("user_id", userId)
    .order("downloaded_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as DownloadRow[];
}
