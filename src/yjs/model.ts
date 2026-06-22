export const WORKSPACE_ID = 'notion-pages-lab';
export const DATABASE_ID = 'roadmap';

export const ROOM_NAMES = {
  workspace: `workspace:${WORKSPACE_ID}`,
  database: `database:${DATABASE_ID}`,
  view: (viewId: string) => `view:${viewId}`,
  page: (pageId: string) => `page-${pageId}`,
} as const;
