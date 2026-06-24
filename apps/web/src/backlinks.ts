import type { SerializedEditorState } from 'lexical';

export interface WorkspaceBacklink {
  sourcePageId: string;
  targetId: string;
  targetType: 'page' | 'board';
  blockId?: string;
  label?: string;
}

type SerializedNode = {
  type?: string;
  text?: string;
  children?: SerializedNode[];
  componentType?: string;
  targetId?: string;
  title?: string;
  blockId?: string;
  [key: string]: unknown;
};

type BlockIndex = {
  blocks?: Array<{ id: string; path: string }>;
};

function walk(node: SerializedNode, visit: (node: SerializedNode, path: number[]) => void, path: number[] = []) {
  visit(node, path);
  if (Array.isArray(node.children)) {
    node.children.forEach((child, index) => walk(child, visit, [...path, index]));
  }
}

function nearestBlockId(path: number[], blockIndex?: BlockIndex) {
  if (!blockIndex?.blocks?.length) return undefined;
  const pathText = path.join('.');
  let best: { id: string; path: string } | undefined;
  for (const block of blockIndex.blocks) {
    if (pathText === block.path || pathText.startsWith(`${block.path}.`)) {
      if (!best || block.path.length > best.path.length) best = block;
    }
  }
  return best?.id;
}

export function collectWorkspaceBacklinks(sourcePageId: string, editorState: SerializedEditorState | null | undefined): WorkspaceBacklink[] {
  if (!editorState) return [];
  const state = editorState as SerializedEditorState & { blockIndex?: BlockIndex };
  const root = (state as unknown as { root?: SerializedNode }).root;
  if (!root) return [];

  const backlinks: WorkspaceBacklink[] = [];
  walk(root, (node, path) => {
    if (node.type !== 'workspace-component') return;
    if (node.componentType !== 'page' && node.componentType !== 'board') return;
    if (typeof node.targetId !== 'string' || !node.targetId) return;
    backlinks.push({
      sourcePageId,
      targetId: node.targetId,
      targetType: node.componentType,
      blockId: nearestBlockId(path, state.blockIndex),
      label: typeof node.title === 'string' && node.title.trim() ? node.title.trim() : undefined,
    });
  });
  return backlinks;
}

export function buildWorkspaceBacklinkIndex(pages: Array<{ id: string; content: SerializedEditorState | null }>) {
  const byTarget = new Map<string, WorkspaceBacklink[]>();
  for (const page of pages) {
    for (const backlink of collectWorkspaceBacklinks(page.id, page.content)) {
      const key = `${backlink.targetType}:${backlink.targetId}`;
      const group = byTarget.get(key) ?? [];
      group.push(backlink);
      byTarget.set(key, group);
    }
  }
  return byTarget;
}
