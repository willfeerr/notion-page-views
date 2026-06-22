import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';

type WalkableNode = SerializedLexicalNode & {
  children?: WalkableNode[];
  text?: string;
};

function collect(node: WalkableNode, parts: string[], limit: number): void {
  if (parts.join(' ').length >= limit) return;
  if (typeof node.text === 'string' && node.text.length > 0) parts.push(node.text);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collect(child, parts, limit);
      if (parts.join(' ').length >= limit) break;
    }
  }
}

/** Best-effort plain-text excerpt of serialized Lexical content, for the compact card preview. */
export function getPlainTextPreview(content: SerializedEditorState | null | undefined, maxLength = 140): string {
  if (!content) return '';
  const parts: string[] = [];
  collect(content.root as WalkableNode, parts, maxLength);
  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
