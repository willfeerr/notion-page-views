import { Popover } from './Popover';

const EMOJI_SET = [
  '📄', '📝', '📋', '📌', '📎', '🗂️', '📁', '🔖',
  '💡', '🎯', '🚀', '⚡', '🔥', '✅', '⭐', '🏆',
  '📊', '📈', '🧩', '🛠️', '🔧', '💻', '🧠', '📦',
  '🗒️', '📅', '⏰', '🔔', '🏷️', '💬', '📣', '✏️',
  '🌱', '🌟', '🎨', '🎬', '🎧', '☕', '🧪', '🌍',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClear?: () => void;
  trigger: (props: { toggle: () => void }) => React.ReactNode;
}

export function EmojiPicker({ onSelect, onClear, trigger }: EmojiPickerProps) {
  return (
    <Popover align="left" trigger={({ toggle }) => trigger({ toggle })}>
      {({ close }) => (
        <div className="npc-emoji-picker">
          <div className="npc-emoji-grid">
            {EMOJI_SET.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="npc-emoji-btn"
                onClick={() => {
                  onSelect(emoji);
                  close();
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
          {onClear && (
            <button
              type="button"
              className="npc-emoji-clear"
              onClick={() => {
                onClear();
                close();
              }}
            >
              Remover ícone
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}
