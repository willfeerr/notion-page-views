export function normalizeHocuspocusUrl(url?: string): string {
  const value = url?.trim() ?? '';
  if (!value) return '';
  if (value.startsWith('https://')) return `wss://${value.slice('https://'.length)}`;
  if (value.startsWith('http://')) return `ws://${value.slice('http://'.length)}`;
  return value;
}
