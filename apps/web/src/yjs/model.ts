export const ROOM_NAMES = {
  workspace: 'workspace:notion-pages-lab',
  legacyDatabase: 'database:roadmap',
  legacyDataSource: (dataSourceId: string) => `database:${dataSourceId}:v2`,
  database: (databaseId: string) => `database:${databaseId}:v1`,
  dataSource: (dataSourceId: string) => `datasource:${dataSourceId}:v1`,
  view: (viewId: string) => `view:${viewId}`,
  page: (pageId: string) => `page-${pageId}`,
} as const;
