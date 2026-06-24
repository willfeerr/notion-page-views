export const ROOM_NAMES = {
  workspace: 'workspace:notion-pages-lab:v2',
  operations: 'operations:notion-pages-lab:v1',
  legacyDatabase: 'database:roadmap',
  legacyDataSource: (dataSourceId: string) => `database:${dataSourceId}:v2`,
  database: (databaseId: string) => `database:${databaseId}:v1`,
  dataSource: (dataSourceId: string) => `datasource:${dataSourceId}:v1`,
  view: (viewId: string) => `view:${viewId}:v2`,
  page: (pageId: string) => `page:${pageId}:v2`,
} as const;
