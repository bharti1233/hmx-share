import { useState } from "react";
import { ChevronRight, FileIcon, FolderIcon } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { TreeNode } from "@/lib/folder-transfer";

function Node({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  return (
    <li>
      <div
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40"
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        {node.isDir ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
            />
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{node.name}</span>
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="w-3.5 shrink-0" />
            <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground">{node.name}</span>
          </div>
        )}
        <span className="shrink-0 text-muted-foreground/70">{formatBytes(node.size)}</span>
      </div>
      {node.isDir && open && node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <Node key={c.path} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FileTree({ nodes }: { nodes: TreeNode[] }) {
  return (
    <ul className="max-h-64 overflow-auto rounded-xl border border-border/60 bg-background/40 py-1 text-xs">
      {nodes.map((n) => (
        <Node key={n.path} node={n} depth={0} />
      ))}
    </ul>
  );
}
