'use client';

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin, MenuOption, useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import {
  $createParagraphNode, $getSelection, $isRangeSelection,
  type LexicalEditor, type TextNode,
} from 'lexical';
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { $setBlocksType } from '@lexical/selection';
import { INSERT_CHECK_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { $createCalloutNode, type CalloutColor } from './nodes/CalloutNode';
import { $createToggleContainerNode, $createToggleTitleNode, $createToggleContentNode } from './nodes/ToggleNode';
import { $createToggleHeadingNode } from './nodes/ToggleHeadingNode';
import { INSERT_IMAGE_COMMAND } from './nodes/ImageNode';
import { INSERT_EMBED_COMMAND } from './nodes/EmbedNode';
import { INSERT_MATH_COMMAND } from './nodes/MathNode';
import { INSERT_BOOKMARK_COMMAND } from './nodes/BookmarkNode';
import { INSERT_COLUMN_LAYOUT_COMMAND } from './nodes/ColumnLayoutNode';
import {
  Heading1, Heading2, Heading3, Pilcrow, List, ListOrdered, ListChecks,
  Quote, Minus, Code, Table, Image, Video, FunctionSquare,
  Columns2, AlertCircle, ChevronRight, BookmarkIcon, AlignLeft,
  ChevronsDown, type LucideIcon,
} from 'lucide-react';

class BlockOption extends MenuOption {
  title: string;
  description: string;
  Icon: LucideIcon;
  group: string;
  keywords: string[];
  onSelect: (editor: LexicalEditor) => void;

  constructor(opts: {
    title: string; description: string; icon: LucideIcon;
    group?: string; keywords?: string[];
    onSelect: (editor: LexicalEditor) => void;
  }) {
    super(opts.title);
    this.title = opts.title;
    this.description = opts.description;
    this.Icon = opts.icon;
    this.group = opts.group ?? 'Básicos';
    this.keywords = opts.keywords ?? [];
    this.onSelect = opts.onSelect;
  }
}

function setHeading(tag: HeadingTagType) {
  return (editor: LexicalEditor) =>
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createHeadingNode(tag));
    });
}

function insertToggle(editor: LexicalEditor) {
  editor.update(() => {
    const sel = $getSelection();
    if (!$isRangeSelection(sel)) return;
    const container = $createToggleContainerNode(true);
    const title = $createToggleTitleNode();
    const content = $createToggleContentNode();
    content.append($createParagraphNode());
    container.append(title, content);
    $setBlocksType(sel, () => $createParagraphNode());
    sel.insertNodes([container]);
  });
}

const CALLOUT_PRESETS: Array<{ label: string; color: CalloutColor; emoji: string }> = [
  { label: 'Callout (cinza)',    color: 'gray',   emoji: '💡' },
  { label: 'Callout (azul)',     color: 'blue',   emoji: 'ℹ️' },
  { label: 'Callout (verde)',    color: 'green',  emoji: '✅' },
  { label: 'Callout (laranja)',  color: 'orange', emoji: '⚠️' },
  { label: 'Callout (vermelho)', color: 'red',    emoji: '🚨' },
];

const ALL_OPTIONS: BlockOption[] = [
  // ── Básicos ──────────────────────────────────────────────────────
  new BlockOption({ title: 'Texto', description: 'Parágrafo simples', icon: Pilcrow,
    keywords: ['paragraph','texto','p'],
    onSelect: (editor) => editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createParagraphNode());
    }),
  }),
  new BlockOption({ title: 'Título 1', description: 'Grande', icon: Heading1,
    keywords: ['h1','titulo','heading'], onSelect: setHeading('h1') }),
  new BlockOption({ title: 'Título 2', description: 'Médio', icon: Heading2,
    keywords: ['h2','titulo','heading'], onSelect: setHeading('h2') }),
  new BlockOption({ title: 'Título 3', description: 'Pequeno', icon: Heading3,
    keywords: ['h3','titulo','heading'], onSelect: setHeading('h3') }),
  new BlockOption({ title: 'Toggle Título 1', description: 'Título colapsável', icon: ChevronsDown,
    keywords: ['toggle','h1','titulo','colapso'],
    onSelect: (editor) => editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        const node = $createToggleHeadingNode('h1');
        $setBlocksType(sel, () => $createParagraphNode());
        sel.insertNodes([node]);
      }
    }),
  }),
  new BlockOption({ title: 'Toggle Título 2', description: 'Título colapsável', icon: ChevronsDown,
    keywords: ['toggle','h2','colapso'],
    onSelect: (editor) => editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        const node = $createToggleHeadingNode('h2');
        $setBlocksType(sel, () => $createParagraphNode());
        sel.insertNodes([node]);
      }
    }),
  }),
  new BlockOption({ title: 'Lista com marcadores', description: 'Bullet list', icon: List,
    keywords: ['bullet','lista','ul'],
    onSelect: (e) => e.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
  }),
  new BlockOption({ title: 'Lista numerada', description: 'Ordered list', icon: ListOrdered,
    keywords: ['numbered','lista','ol'],
    onSelect: (e) => e.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
  }),
  new BlockOption({ title: 'Lista de tarefas', description: 'Checkboxes', icon: ListChecks,
    keywords: ['todo','tarefa','checklist','checkbox'],
    onSelect: (e) => e.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
  }),
  new BlockOption({ title: 'Toggle', description: 'Seção colapsável', icon: ChevronRight,
    keywords: ['toggle','colapso','details'], onSelect: insertToggle }),
  new BlockOption({ title: 'Citação', description: 'Blockquote', icon: Quote,
    keywords: ['quote','citacao','blockquote'],
    onSelect: (editor) => editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createQuoteNode());
    }),
  }),
  new BlockOption({ title: 'Divisor', description: 'Linha separadora', icon: Minus,
    keywords: ['divider','divisor','hr'],
    onSelect: (e) => e.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined),
  }),
  new BlockOption({ title: 'Bloco de código', description: 'Código com highlight', icon: Code,
    keywords: ['code','codigo','pre'],
    onSelect: (editor) => editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, () => $createCodeNode());
    }),
  }),

  // ── Callout ──────────────────────────────────────────────────────
  ...CALLOUT_PRESETS.map(c => new BlockOption({
    title: c.label, description: 'Caixa de destaque', icon: AlertCircle, group: 'Callout',
    keywords: ['callout','caixa','destaque', c.color],
    onSelect: (editor) => editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        const node = $createCalloutNode(c.emoji, c.color);
        node.append($createParagraphNode());
        $setBlocksType(sel, () => $createParagraphNode());
        sel.insertNodes([node]);
      }
    }),
  })),

  // ── Mídia ──────────────────────────────────────────────────────
  new BlockOption({ title: 'Imagem', description: 'Inserir por URL', icon: Image, group: 'Mídia',
    keywords: ['image','imagem','foto'],
    onSelect: (editor) => {
      const url = window.prompt('URL da imagem:');
      if (url) editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src: url });
    },
  }),
  new BlockOption({ title: 'Bookmark', description: 'Card de link com prévia', icon: BookmarkIcon, group: 'Mídia',
    keywords: ['bookmark','link','url','card'],
    onSelect: (editor) => {
      const url = window.prompt('URL:');
      if (url) editor.dispatchCommand(INSERT_BOOKMARK_COMMAND, { url });
    },
  }),
  new BlockOption({ title: 'Embed de vídeo', description: 'YouTube e outros', icon: Video, group: 'Mídia',
    keywords: ['video','youtube','embed','loom'],
    onSelect: (editor) => {
      const url = window.prompt('URL do vídeo:');
      if (url) editor.dispatchCommand(INSERT_EMBED_COMMAND, { url });
    },
  }),

  // ── Avançado ──────────────────────────────────────────────────────
  new BlockOption({ title: 'Tabela', description: '3×3 linhas e colunas', icon: Table, group: 'Avançado',
    keywords: ['table','tabela','grid'],
    onSelect: (e) => e.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '3', columns: '3', includeHeaders: true }),
  }),
  new BlockOption({ title: 'Equação', description: 'LaTeX via KaTeX', icon: FunctionSquare, group: 'Avançado',
    keywords: ['math','formula','equacao','latex','katex'],
    onSelect: (e) => e.dispatchCommand(INSERT_MATH_COMMAND, { latex: '', inline: false }),
  }),

  // ── Layout ──────────────────────────────────────────────────────
  new BlockOption({ title: '2 colunas', description: 'Layout lado a lado', icon: Columns2, group: 'Layout',
    keywords: ['column','coluna','2','layout'],
    onSelect: (e) => e.dispatchCommand(INSERT_COLUMN_LAYOUT_COMMAND, { columns: 2 }),
  }),
  new BlockOption({ title: '3 colunas', description: 'Layout em 3 colunas', icon: Columns2, group: 'Layout',
    keywords: ['column','coluna','3','layout'],
    onSelect: (e) => e.dispatchCommand(INSERT_COLUMN_LAYOUT_COMMAND, { columns: 3 }),
  }),
  new BlockOption({ title: '4 colunas', description: 'Layout em 4 colunas', icon: AlignLeft, group: 'Layout',
    keywords: ['column','coluna','4','layout'],
    onSelect: (e) => e.dispatchCommand(INSERT_COLUMN_LAYOUT_COMMAND, { columns: 4 }),
  }),
];

export function SlashCommandPlugin() {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', { minLength: 0 });

  const options = useMemo(() => {
    if (!query) return ALL_OPTIONS;
    const lower = query.toLowerCase();
    return ALL_OPTIONS.filter(
      (o) => o.title.toLowerCase().includes(lower) || o.keywords.some((k) => k.includes(lower)),
    );
  }, [query]);

  const onSelectOption = useCallback(
    (option: BlockOption, nodeToRemove: TextNode | null, closeMenu: () => void) => {
      editor.update(() => { nodeToRemove?.remove(); });
      option.onSelect(editor);
      closeMenu();
    },
    [editor],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, BlockOption[]>();
    for (const o of options) {
      const g = map.get(o.group) ?? [];
      g.push(o);
      map.set(o.group, g);
    }
    return map;
  }, [options]);

  return (
    <LexicalTypeaheadMenuPlugin<BlockOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(anchorRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (!anchorRef.current || options.length === 0) return null;
        let globalIndex = 0;
        return createPortal(
          <div className="npc-slash-menu">
            {Array.from(grouped.entries()).map(([groupName, groupOpts]) => (
              <div key={groupName}>
                <div className="npc-slash-group-label">{groupName}</div>
                {groupOpts.map((option) => {
                  const idx = globalIndex++;
                  const Icon = option.Icon;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`npc-slash-item ${idx === selectedIndex ? 'is-selected' : ''}`}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => selectOptionAndCleanUp(option)}
                    >
                      <span className="npc-slash-item-icon"><Icon size={16} strokeWidth={1.75} /></span>
                      <span className="npc-slash-item-text">
                        <span className="npc-slash-item-title">{option.title}</span>
                        <span className="npc-slash-item-description">{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          anchorRef.current,
        );
      }}
    />
  );
}
