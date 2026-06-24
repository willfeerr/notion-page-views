import type { SerializedEditorState } from 'lexical';

export interface BlockIdentityEntry {
  id: string;
  pageId?: string;
  path: string;
  type: string;
  fingerprint: string;
  text: string;
  updatedAt: string;
}

export interface BlockIdentityIndex {
  version: 1;
  updatedAt: string;
  blocks: BlockIdentityEntry[];
}

export type SerializedEditorStateWithBlockIndex = SerializedEditorState & { blockIndex?: BlockIdentityIndex };

type SerializedNode = {
  type?: string;
  text?: string;
  children?: SerializedNode[];
  componentType?: string;
  targetId?: string;
  url?: string;
  [key: string]: unknown;
};

const BLOCK_NODE_TYPES = new Set([
  'paragraph', 'heading', 'quote', 'listitem', 'code',
  'callout', 'toggle-heading', 'image', 'embed', 'bookmark',
  'math', 'workspace-component', 'table', 'tablerow', 'tablecell',
]);

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function collectText(node: SerializedNode): string {
  const own = typeof node.text === 'string' ? node.text : '';
  const childText = Array.isArray(node.children) ? node.children.map(collectText).join(' ') : '';
  const semanticTarget = node.type === 'workspace-component' && typeof node.targetId === 'string' ? `${node.componentType ?? 'resource'}:${node.targetId}` : '';
  const semanticUrl = typeof node.url === 'string' ? node.url : '';
  return normalizeText([own, childText, semanticTarget, semanticUrl].filter(Boolean).join(' '));
}

function fingerprintFor(node: SerializedNode, text: string) {
  return `${node.type ?? 'unknown'}:${text.toLocaleLowerCase('pt-BR')}`;
}

function walkBlocks(node: SerializedNode, path: number[] = [], output: Omit<BlockIdentityEntry, 'id' | 'updatedAt'>[] = []) {
  const type = typeof node.type === 'string' ? node.type : 'unknown';
  if (BLOCK_NODE_TYPES.has(type)) {
    const text = collectText(node);
    output.push({ path: path.join('.'), type, fingerprint: fingerprintFor(node, text), text });
  }
  if (Array.isArray(node.children)) node.children.forEach((child, index) => walkBlocks(child, [...path, index], output));
  return output;
}

function indexPreviousBlocks(previous?: BlockIdentityIndex) {
  const byPathAndFingerprint = new Map<string, BlockIdentityEntry>();
  const byPath = new Map<string, BlockIdentityEntry>();
  const byFingerprint = new Map<string, BlockIdentityEntry[]>();
  for (const block of previous?.blocks ?? []) {
    byPathAndFingerprint.set(`${block.path}|${block.fingerprint}`, block);
    byPath.set(block.path, block);
    const group = byFingerprint.get(block.fingerprint) ?? [];
    group.push(block);
    byFingerprint.set(block.fingerprint, group);
  }
  return { byPathAndFingerprint, byPath, byFingerprint };
}

export function createBlockIdentityIndex(editorState: SerializedEditorState, options: { pageId?: string; previous?: BlockIdentityIndex; now?: string; createId?: () => string } = {}): BlockIdentityIndex {
  const now = options.now ?? new Date().toISOString();
  const createId = options.createId ?? (() => `block-${crypto.randomUUID()}`);
  const root = (editorState as unknown as { root?: SerializedNode }).root;
  const candidates = root ? walkBlocks(root) : [];
  const previous = indexPreviousBlocks(options.previous);
  const usedIds = new Set<string>();

  const blocks = candidates.map((candidate) => {
    const exact = previous.byPathAndFingerprint.get(`${candidate.path}|${candidate.fingerprint}`);
    const samePath = previous.byPath.get(candidate.path);
    const fuzzy = previous.byFingerprint.get(candidate.fingerprint)?.find((entry) => !usedIds.has(entry.id));
    const source = [exact, samePath, fuzzy].find((entry): entry is BlockIdentityEntry => Boolean(entry && !usedIds.has(entry.id)));
    const id = source?.id ?? createId();
    usedIds.add(id);
    return { id, pageId: options.pageId, updatedAt: now, ...candidate };
  });

  return { version: 1, updatedAt: now, blocks };
}

export function withStableBlockIds(editorState: SerializedEditorState, options: { pageId?: string; previous?: BlockIdentityIndex; now?: string; createId?: () => string } = {}): SerializedEditorStateWithBlockIndex {
  return { ...(editorState as SerializedEditorStateWithBlockIndex), blockIndex: createBlockIdentityIndex(editorState, options) };
}

export function getBlockIdentityIndex(editorState?: SerializedEditorState | null): BlockIdentityIndex | undefined {
  return (editorState as SerializedEditorStateWithBlockIndex | null | undefined)?.blockIndex;
}
