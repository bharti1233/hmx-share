export const MANIFEST_TYPE = "application/x-hmx-manifest";

export interface ManifestEntry {
  path: string; // relative path inside the transfer, e.g. "MyProject/src/main.js"
  size: number;
  type?: string;
}

export interface TransferManifest {
  version: 1;
  root: string;
  files: ManifestEntry[];
}

export function manifestStoragePath(code: string) {
  return `${code}/__hmx_manifest.json`;
}

export function fileStoragePath(code: string, relPath: string) {
  return `${code}/files/${normalizeRelPath(relPath)}`;
}

export function normalizeRelPath(p: string) {
  return p
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .split("/")
    .filter((s) => s && s !== "." && s !== "..")
    .join("/");
}

/** Common root folder across relative paths, or "" when files are loose. */
export function commonRoot(paths: string[]): string {
  if (!paths.length) return "";
  const first = paths[0].split("/");
  if (first.length < 2) return "";
  const root = first[0];
  return paths.every((p) => p.split("/")[0] === root && p.includes("/")) ? root : "";
}

export function countFolders(paths: string[]): number {
  const dirs = new Set<string>();
  for (const p of paths) {
    const parts = p.split("/");
    parts.pop();
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      dirs.add(acc);
    }
  }
  return dirs.size;
}

export interface TreeNode {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  children: TreeNode[];
}

export function buildTree(entries: { path: string; size: number }[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", size: 0, isDir: true, children: [] };
  for (const e of entries) {
    const parts = e.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1;
      const path = node.path ? `${node.path}/${part}` : part;
      let child = node.children.find((c) => c.name === part && c.isDir === !isLeaf);
      if (!child) {
        child = { name: part, path, size: 0, isDir: !isLeaf, children: [] };
        node.children.push(child);
      }
      child.size += e.size;
      node = child;
    });
    root.size += e.size;
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    nodes.forEach((n) => sort(n.children));
  };
  sort(root.children);
  return root.children;
}
