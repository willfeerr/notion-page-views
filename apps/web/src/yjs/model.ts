export const ROOM_NAMES = {
  workspace: 'workspace:notion-pages-lab',
  database: 'database:roadmap',
  view: (viewId: string) => `view:${viewId}`,
  page: (pageId: string) => `page-${pageId}`,
} as const;
