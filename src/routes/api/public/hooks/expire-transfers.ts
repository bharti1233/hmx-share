import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/expire-transfers")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Find rows that are due to expire (active + past expiry) OR already expired but files still in storage
          const { data: due, error: dueErr } = await supabaseAdmin
            .from("transfers")
            .select("id, storage_path")
            .lte("expires_at", new Date().toISOString())
            .neq("status", "deleted");
          if (dueErr) throw new Error(dueErr.message);

          let deletedFiles = 0;
          if (due && due.length > 0) {
            const paths = due.map((r) => r.storage_path);
            const { error: rmErr } = await supabaseAdmin.storage
              .from("transfers")
              .remove(paths);
            if (!rmErr) deletedFiles = paths.length;

            const ids = due.map((r) => r.id);
            await supabaseAdmin
              .from("transfers")
              .update({ status: "deleted" })
              .in("id", ids);
          }

          return new Response(
            JSON.stringify({ ok: true, processed: due?.length ?? 0, deletedFiles }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "expire failed";
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
