# Yjs document architecture

The workspace uses separate Yjs documents for navigation, database containers, data sources, views and page content. A board or calendar is a view over a data source; it is not a data container.

## Rooms and ownership

| Room | Canonical data | Excludes |
|---|---|---|
| `workspace:{workspaceId}:v2` | Ordered container/data-source/view references, navigation and canonical `pageId -> dataSourceId` ownership | Schemas, rows, view configuration, page content |
| `operations:{workspaceId}:v1` | Durable move journal, source snapshots, property mappings and saga phases | Canonical ownership and live rows |
| `database:{databaseId}:v1` | Container metadata plus ordered data-source and view references | Property schema, rows and page content |
| `datasource:{dataSourceId}:v1` | Property definitions, rows, property values and per-view ranks | View filters/layout and Lexical content |
| `view:{viewId}:v2` | `databaseId`, `dataSourceId`, view type, grouping/date property, visible properties and presentation settings | Row membership and page content |
| `page:{pageId}:v2` | Lexical/Yjs content and awareness | Database schema and other pages |

Legacy `database:roadmap` and `database:{id}:v2` rooms are read only during migration. New row and schema writes use `datasource:{id}:v1`; the old rooms remain available for recovery.

## Data source layout

Each data source owns:

- `schema-definitions`: one serialized definition per stable property ID.
- `schema-order`: ordered property IDs.
- `pages`: one nested `Y.Map` per page containing property values, metadata projection, preview and per-view ranks.
- `page-order`: deterministic fallback ordering.
- `page-layout`: pinned properties and ordered, collapsible property sections.
- `page-templates`: reusable page metadata, editable property defaults and Lexical snapshots.

## View layout

A view points to one database container through `databaseId` and one source through `dataSourceId`. Its page list is derived from rows whose canonical ownership points to that source. Views never persist a membership copy.

Board, Calendar, Table, List, Gallery, Timeline and Chart use this same reference contract. Table is the canonical row-oriented interface; the other types are projections over the same query result.

Board ordering is stored as a rank keyed by `viewId` on the data-source row. Moving a card can update its grouping property and rank in one data-source transaction.

## Page properties

Database properties belong to the data-source schema, not to an individual page and not to the workspace. Values remain per row.

Removing a property archives its row values inside the data source. Adding the same stable property ID again restores those values instead of silently discarding them.

Property defaults, read-only behavior, serialization and comparison are registered by type. Formula and Rollup are derived through a typed expression/aggregation evaluator and are not stored as user-editable values.

A Relation definition stores its `targetDataSourceId`, optional `cardinality` and optional `inversePropertyId`; row values contain only referenced page IDs. Updating a relation filters IDs against canonical target ownership and never changes either page's ownership. Deleting a target page removes its ID from relation values in every loaded data source.

Inverse relations are materialized during read as a projection. The inverse side can feed formulas and rollups, but the derived edge is not stored as a second membership copy.

Board membership inside a database page is represented as a normal Relation property pointing to the board/data-source target. A board itself remains a view; selecting a board through Relation does not move the page, clone rows or create a move operation. Cross-source transfer remains a separate move command with conversion preview and durable journal phases.

Selecting a different board grouping property changes only the view configuration. Rows without a valid value render in the synthetic `Sem status` lane; the application does not silently rewrite them.

## Creation protocol

Creating a new board:

1. Allocate database, data-source and view IDs.
2. Create the database container room.
3. Create the data-source room with its initial Status definition.
4. Create the view room pointing to both IDs.
5. Publish ownership and references to the workspace.

The sequence is idempotent. An interrupted creation can leave an unreferenced document, but never a workspace reference to an uninitialized document.

## Legacy migration

Migration reads legacy database/view rooms without deleting them, creates `datasource:{id}:v1` rooms only when the destination is empty, builds canonical ownership, writes `databaseId` and `dataSourceId` to workspace/view references, and removes persisted membership from views.

Repeated initialization detects the migration marker and active data-source references, so it does not copy or duplicate rows again.

## Ownership and moves

`page-ownership` in the workspace is the canonical visibility index. Reads and writes resolve the source from this index and never scan every room for the first physical copy.

Moving a page uses an idempotent saga:

1. `prepared` persists the complete source row/schema snapshot and property mapping.
2. `staged` writes converted values to the target and archives unmapped values.
3. `committed` compares and increments the canonical ownership version.
4. `cleaned` removes the physical source row.

The journal can resume an interrupted operation from any phase. A cleaned operation can be undone while the page remains at its target, restoring the original snapshot and incrementing ownership again.

## Growth and compaction

Splitting documents limits update history by ownership boundary. Production persistence should monitor encoded document size, update count and load time per room. When thresholds are exceeded, materialize application state into a new versioned room, update the active reference atomically and retain the previous room for recovery.
