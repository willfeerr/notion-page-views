export const ROOM_NAMES = {
  workspace: 'workspace:notion-pages-lab',
  legacyDatabase: 'database:roadmap',
  database: (databaseId: string) => `database:${databaseId}:v2`,
  view: (viewId: string) => `view:${viewId}`,
  page: (pageId: string) => `page-${pageId}`,
} as const;
