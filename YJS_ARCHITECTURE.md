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

The legacy `database:roadmap` and `database:{id}:v2` rooms are read only during migration. New row and schema writes use `datasource:{id}:v1`; the old rooms remain available for recovery.

## Database container layout

Each database container document owns:

- `database`: container metadata.
- `data-source-ids`: ordered child data sources.
- `view-ids`: ordered views attached to the container.

The first release still creates one data source per new database, but the boundary is explicit and supports multiple sources without another row migration.

## Data source layout

Each data source document owns:

- `schema-definitions`: one serialized definition per stable property ID.
- `schema-order`: ordered property IDs.
- `pages`: one nested `Y.Map` per page containing property values, metadata projection, preview and per-view ranks.
- `page-order`: deterministic fallback ordering.
- `page-layout`: pinned properties and ordered, collapsible property sections shared by its database pages.
- `page-templates`: reusable page metadata, editable property defaults and Lexical snapshots keyed by template ID.

Status option IDs remain stable when a lane is renamed. Changing a page status updates only that row.

## View layout

A view points to one database container through `databaseId` and one source through `dataSourceId`. Its page list is derived from rows whose canonical ownership points to that source. Views never persist a membership copy.

Board, Calendar, Table, List, Gallery, Timeline and Chart use this same reference contract. Table is the canonical
row-oriented interface; the other types are projections over the same query result. Creating a view can either
allocate a new Data Source or select a compatible existing source, without copying rows.

Every view may persist a nested `FilterGroup` AST, ordered sorts, group/subgroup definitions and a projection
containing visible property IDs, card preview and page open mode. The shared query executor applies filters and
sorts before the presentation component renders the rows.

Board ordering is stored as a rank keyed by `viewId` on the data-source row. Moving a card can update its grouping property and rank in one data-source transaction.

A calendar created from an existing date property becomes another view of the owning database. A calendar with a new date property creates a new database.

## Page properties

Database properties belong to the data-source schema, not to an individual page and not to the workspace. The published UI resolves schema by `dataSourceId`; it no longer reads a global union of properties. Values remain per row.

Removing a property archives its row values inside the data source. Adding the same stable property ID again restores those values instead of silently discarding them.

The one-time `audit-properties-v1` repair restores legacy Created time and Last edited time definitions that were previously hidden by a view projection. New data sources create both audit properties by default.

Property defaults, read-only behavior, serialization and comparison are registered by type. The registry now
covers the existing property set plus Relation, Files (URL-backed until object storage exists), Unique ID,
Created by, Last edited by and Place. Unique IDs are deterministic per page and system-managed properties reject
manual row updates. Formula and Rollup are derived through a typed expression/aggregation evaluator and are not
stored as user-editable values.

Standalone pages have no database properties. They must be moved into a database before receiving Status, Date, Person or other database fields.

A Relation definition stores its `targetDataSourceId`; row values contain only referenced page IDs. Updating a
relation filters IDs against canonical target ownership and never changes either page's ownership. Deleting a
target page removes its ID from relation values in every loaded data source.

Board placement is limited to views on the page's current data source. Cross-source transfer is exposed as the
separate `Mover para...` command, which previews every direct conversion and archived property before creating
the journal operation. The last completed move can be undone from the page toolbar.

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

Migration covers both the original shared `database:roadmap` room and the later `database:{id}:v2` rooms:

1. Reads the legacy database and view rooms without deleting them.
2. Keeps the default board and calendar in the shared `roadmap` database.
3. Creates one database container and one data source for every v2 source.
4. Copies schema and rows into `datasource:{id}:v1` only when the destination is empty.
5. Builds canonical ownership without deleting the legacy rooms.
6. Writes `databaseId` and `dataSourceId` to workspace and view references.
7. Removes persisted membership from the view.

Repeated initialization detects the migration marker and active data-source references, so it does not copy or duplicate rows again.

## Ownership and moves

`page-ownership` in the workspace is the canonical visibility index. Reads and writes resolve the source from this index and never scan every room for the first physical copy.

Because source, target and ownership are separate documents, moving a page uses an idempotent saga:

1. `prepared` persists the complete source row/schema snapshot and property mapping.
2. `staged` writes converted values to the target and archives unmapped values.
3. `committed` compares and increments the canonical ownership version. This is the visibility commit point.
4. `cleaned` removes the physical source row.

The journal can resume an interrupted operation from any phase. A competing move with a stale ownership
version becomes `conflicted` and removes its staged target row. A cleaned operation can be undone while
the page remains at its target, restoring the original snapshot and incrementing ownership again.

## Hocuspocus

Room names and ownership do not depend on the provider. Replacing `BroadcastProvider` with Hocuspocus changes transport and persistence only.

Authorization should validate the room prefix, workspace membership and referenced ID. Awareness is ephemeral and must not be persisted.

## Growth and compaction

Splitting documents limits update history by ownership boundary. Production persistence should monitor encoded document size, update count and load time per room.

When thresholds are exceeded, materialize application state into a new versioned room, update the active reference atomically and retain the previous room for recovery. Merging binary Yjs updates reduces log entries but does not remove all CRDT tombstones.
