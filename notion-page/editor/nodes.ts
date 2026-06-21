import type { Klass, LexicalNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { CalloutNode } from './nodes/CalloutNode';
import { ToggleContainerNode, ToggleTitleNode, ToggleContentNode } from './nodes/ToggleNode';
import { ToggleHeadingNode } from './nodes/ToggleHeadingNode';
import { ImageNode } from './nodes/ImageNode';
import { EmbedNode } from './nodes/EmbedNode';
import { MathNode } from './nodes/MathNode';
import { MentionNode } from './nodes/MentionNode';
import { ColumnLayoutNode, ColumnNode } from './nodes/ColumnLayoutNode';
import { BookmarkNode } from './nodes/BookmarkNode';

export const editorNodes: ReadonlyArray<Klass<LexicalNode>> = [
  // Core rich-text
  HeadingNode, QuoteNode,
  ListNode, ListItemNode,
  LinkNode, AutoLinkNode,
  CodeNode, CodeHighlightNode,
  HorizontalRuleNode,
  // Table
  TableNode, TableCellNode, TableRowNode,
  // Custom block nodes
  CalloutNode,
  ToggleContainerNode, ToggleTitleNode, ToggleContentNode,
  ToggleHeadingNode,
  ImageNode,
  EmbedNode,
  MathNode,
  BookmarkNode,
  // Inline custom nodes
  MentionNode,
  // Layout
  ColumnLayoutNode, ColumnNode,
];
