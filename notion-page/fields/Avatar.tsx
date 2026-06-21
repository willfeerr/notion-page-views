import type { PersonOption } from '../types';
import { colorForId, COLOR_TOKENS } from '../propertyTokens';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ person, size = 20 }: { person: PersonOption; size?: number }) {
  if (person.avatarUrl) {
    return (
      <img
        src={person.avatarUrl}
        alt={person.name}
        className="npc-avatar npc-avatar-img"
        style={{ width: size, height: size }}
      />
    );
  }
  const color = person.avatarColor ?? colorForId(person.id);
  const tokens = COLOR_TOKENS[color];
  return (
    <span
      className="npc-avatar"
      style={{ width: size, height: size, background: tokens.dot, fontSize: size * 0.42 }}
      aria-hidden
    >
      {initials(person.name)}
    </span>
  );
}
