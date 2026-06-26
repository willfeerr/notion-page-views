import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appPath = resolve(process.cwd(), 'src/App.tsx');
const typesPath = resolve(process.cwd(), 'notion-page/types.ts');
let source = readFileSync(appPath, 'utf8');
let typesSource = readFileSync(typesPath, 'utf8');
const originalSource = source;
const originalTypesSource = typesSource;

function removeExact(fragment, label) {
  if (!source.includes(fragment)) {
    console.warn(`[cleanup-board-placement-shell] fragment not found: ${label}`);
    return;
  }
  source = source.replace(fragment, '');
}

function removeExactFromTypes(fragment, label) {
  if (!typesSource.includes(fragment)) {
    console.warn(`[cleanup-board-placement-shell] types fragment not found: ${label}`);
    return;
  }
  typesSource = typesSource.replace(fragment, '');
}

function replaceExact(fragment, replacement, label) {
  if (!source.includes(fragment)) {
    console.warn(`[cleanup-board-placement-shell] fragment not found: ${label}`);
    return;
  }
  source = source.replace(fragment, replacement);
}

source = source.replace(
  "import type { BoardLinkOption, BoardLinkValue, CollabPresence, DatabasePageLayout, DatabasePageTemplate, NotionPageData, NotionSchema, RelationTargetOption, StoredPropertyValue } from '../notion-page/types';",
  "import type { CollabPresence, DatabasePageLayout, DatabasePageTemplate, NotionPageData, NotionSchema, RelationTargetOption, StoredPropertyValue } from '../notion-page/types';",
);

if (!source.includes("import { resolveCollabConfig } from './collabConfig';")) {
  source = source.replace(
    "import { capturePageTemplate, instantiatePageTemplate } from './pageTemplates';\n",
    "import { capturePageTemplate, instantiatePageTemplate } from './pageTemplates';\nimport { resolveCollabConfig } from './collabConfig';\n",
  );
}

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

if (!source.includes('resolveCollabConfig({ room: ROOM_NAMES.page(openPage.id)')) {
  replaceExact(
    "              collab={{ transport: 'broadcast', room: ROOM_NAMES.page(openPage.id), user: { ...collabUser, location: editingLocation }, onPresenceChange: setPresence }}",
    "              collab={{ ...resolveCollabConfig({ room: ROOM_NAMES.page(openPage.id), user: { ...collabUser, location: editingLocation } }), onPresenceChange: setPresence }}",
    'NotionPageView collab config',
  );
}

removeExactFromTypes(`export interface BoardLinkLane { id: string; name: string; color: PropertyColor; }
export interface BoardLinkOption { id: string; databaseId: string; title: string; lanes: BoardLinkLane[]; }
export interface BoardLinkValue { boardId: string; laneId: string | null; }

`, 'BoardLink legacy types');

const forbidden = [
  'BoardLinkOption',
  'BoardLinkValue',
  'openPageBoard',
  'boardOptions',
  'boardPlacement',
  'onBoardPlacementChange',
  'updateBoardPlacement',
];
const remaining = forbidden.filter((term) => source.includes(term) || typesSource.includes(term));
if (remaining.length) {
  throw new Error(`Board placement cleanup incomplete. Remaining terms: ${remaining.join(', ')}`);
}

if (source === originalSource && typesSource === originalTypesSource) {
  console.log('[cleanup-board-placement-shell] App.tsx and types.ts already clean.');
} else {
  if (source !== originalSource) writeFileSync(appPath, source);
  if (typesSource !== originalTypesSource) writeFileSync(typesPath, typesSource);
  console.log('[cleanup-board-placement-shell] App.tsx and legacy BoardLink types cleaned.');
}
