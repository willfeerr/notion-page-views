'use client';

/**
 * @mention typeahead plugin — type "@" to search and insert person mentions.
 * Accepts a `people` prop (same PersonOption list used by PersonField)
 * so mentions are scoped to the people available in your app's schema.
 */

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin, MenuOption, useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { type TextNode } from 'lexical';
import { $createMentionNode } from './nodes/MentionNode';
import { Avatar } from '../fields/Avatar';
import type { PersonOption } from '../types';

class MentionOption extends MenuOption {
  person: PersonOption;
  constructor(person: PersonOption) { super(person.id); this.person = person; }
}

interface MentionPluginProps {
  people: PersonOption[];
}

export function MentionPlugin({ people }: MentionPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);

  const triggerFn = useBasicTypeaheadTriggerMatch('@', { minLength: 0 });

  const options = useMemo(() => {
    if (!query) return people.map((p) => new MentionOption(p));
    const lower = query.toLowerCase();
    return people
      .filter((p) => p.name.toLowerCase().includes(lower))
      .map((p) => new MentionOption(p));
  }, [query, people]);

  const onSelectOption = useCallback(
    (option: MentionOption, nodeToRemove: TextNode | null, closeMenu: () => void) => {
      editor.update(() => {
        const mention = $createMentionNode(option.person.id, option.person.name, 'person');
        if (nodeToRemove) {
          nodeToRemove.replace(mention);
        }
      });
      closeMenu();
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<MentionOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={(anchorRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (!anchorRef.current || options.length === 0) return null;
        return createPortal(
          <div className="npc-slash-menu npc-mention-menu">
            <div className="npc-slash-group-label">PESSOAS</div>
            {options.map((option, i) => (
              <button
                key={option.key}
                type="button"
                className={`npc-slash-item ${i === selectedIndex ? 'is-selected' : ''}`}
                onMouseEnter={() => setHighlightedIndex(i)}
                onClick={() => selectOptionAndCleanUp(option)}
              >
                <span className="npc-slash-item-icon">
                  <Avatar person={option.person} size={22} />
                </span>
                <span className="npc-slash-item-text">
                  <span className="npc-slash-item-title">{option.person.name}</span>
                </span>
              </button>
            ))}
          </div>,
          anchorRef.current,
        );
      }}
    />
  );
}
