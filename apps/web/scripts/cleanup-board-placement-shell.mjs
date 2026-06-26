import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appPath = resolve(process.cwd(), 'src/App.tsx');
let source = readFileSync(appPath, 'utf8');
const original = source;

function removeExact(fragment, label) {
  if (!source.includes(fragment)) {
    console.warn(`[cleanup-board-placement-shell] fragment not found: ${label}`);
    return;
  }
  source = source.replace(fragment, '');
}

source = source.replace(
  "import type { BoardLinkOption, BoardLinkValue, CollabPresence, DatabasePageLayout, DatabasePageTemplate, NotionPageData, NotionSchema, RelationTargetOption, StoredPropertyValue } from '../notion-page/types';",
  "import type { CollabPresence, DatabasePageLayout, DatabasePageTemplate, NotionPageData, NotionSchema, RelationTargetOption, StoredPropertyValue } from '../notion-page/types';",
);

removeExact(`  const openPageBoard = openPage
    ? resources.find((resource): resource is BoardResource => resource.type === 'board' && resource.pageIds.includes(openPage.id))
    : undefined;
`, 'openPageBoard');

removeExact(`  const boardOptions: BoardLinkOption[] = resources.flatMap((resource) => {
    if (resource.type !== 'board') return [];
    const grouping = dataSourceSchemas[resource.dataSourceId]?.properties.find((property) => property.id === resource.statusPropertyId && property.type === 'status');
    if (!grouping || grouping.type !== 'status') return [];
    return [{
      id: resource.id,
      databaseId: resource.dataSourceId,
      title: resource.title,
      lanes: grouping.options.map((option) => ({ id: option.id, name: option.name, color: option.color })),
    }];
  });
`, 'boardOptions');

removeExact(`  const boardPlacement: BoardLinkValue | null = openPage && openPageBoard
    ? {
        boardId: openPageBoard.id,
        laneId: typeof openPage.properties[openPageBoard.statusPropertyId] === 'string'
          ? openPage.properties[openPageBoard.statusPropertyId] as string
          : null,
      }
    : null;
`, 'boardPlacement');

const updateBoardPlacementStart = source.indexOf('  function updateBoardPlacement(');
if (updateBoardPlacementStart !== -1) {
  const moveOpenPageStart = source.indexOf('\n  function moveOpenPage(', updateBoardPlacementStart);
  if (moveOpenPageStart === -1) throw new Error('Could not find moveOpenPage after updateBoardPlacement');
  source = source.slice(0, updateBoardPlacementStart) + source.slice(moveOpenPageStart + 1);
}

removeExact(`              boardOptions={boardOptions.filter((board) => board.databaseId === openPageDataSourceId)}
              boardPlacement={boardPlacement}
              onBoardPlacementChange={updateBoardPlacement}
`, 'NotionPageView board placement props');

const forbidden = [
  'BoardLinkOption',
  'BoardLinkValue',
  'openPageBoard',
  'boardOptions',
  'boardPlacement',
  'onBoardPlacementChange',
  'updateBoardPlacement',
];
const remaining = forbidden.filter((term) => source.includes(term));
if (remaining.length) {
  throw new Error(`Board placement cleanup incomplete. Remaining terms: ${remaining.join(', ')}`);
}

if (source === original) {
  console.log('[cleanup-board-placement-shell] App.tsx already clean.');
} else {
  writeFileSync(appPath, source);
  console.log('[cleanup-board-placement-shell] App.tsx cleaned.');
}
