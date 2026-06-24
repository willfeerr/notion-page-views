# Yjs document architecture

The workspace uses separate Yjs documents for navigation, database containers, data sources, views and page content. A board or calendar is a view over a data source; it is not a data container.

## Rooms and ownership

| Room | Canonical data | Excludes |
|---|---|---|
| `workspace:{workspaceId}` | Ordered container/data-source/view references, navigation and canonical `pageId -> dataSourceId` ownership | Schemas, rows, view configuration, page content |
| `database:{databaseId}:v1` | Container metadata plus ordered data-source and view references | Property schema, rows and page content |
| `datasource:{dataSourceId}:v1` | Property definitions, rows, property values and per-view ranks | View filters/layout and Lexical content |
| `view:{viewId}` | `databaseId`, `dataSourceId`, view type, grouping/date property, visible properties and presentation settings | Row membership and page content |
| `page-{pageId}` | Lexical/Yjs content and awareness | Database schema and other pages |

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

Status option IDs remain stable when a lane is renamed. Changing a page status updates only that row.

## View layout

A view points to one database container through `databaseId` and one source through `dataSourceId`. Its page list is derived from rows whose canonical ownership points to that source. Views never persist a membership copy.

Board ordering is stored as a rank keyed by `viewId` on the data-source row. Moving a card can update its grouping property and rank in one data-source transaction.

A calendar created from an existing date property becomes another view of the owning database. A calendar with a new date property creates a new database.

## Page properties

Database properties belong to the data-source schema, not to an individual page and not to the workspace. The published UI resolves schema by `dataSourceId`; it no longer reads a global union of properties. Values remain per row.

Removing a property archives its row values inside the data source. Adding the same stable property ID again restores those values instead of silently discarding them.

Standalone pages have no database properties. They must be moved into a database before receiving Status, Date, Person or other database fields.

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

The current compatibility move stages the target row, commits ownership, then cleans the source. The domain now defines `MoveOperation`, `PropertyMapping` and recoverable row snapshots, but the durable operation journal, schema-mapping confirmation and undo protocol are intentionally deferred to the next phase.

## Hocuspocus

Room names and ownership do not depend on the provider. Replacing `BroadcastProvider` with Hocuspocus changes transport and persistence only.

Authorization should validate the room prefix, workspace membership and referenced ID. Awareness is ephemeral and must not be persisted.

## Growth and compaction

Splitting documents limits update history by ownership boundary. Production persistence should monitor encoded document size, update count and load time per room.

When thresholds are exceeded, materialize application state into a new versioned room, update the active reference atomically and retain the previous room for recovery. Merging binary Yjs updates reduces log entries but does not remove all CRDT tombstones.
