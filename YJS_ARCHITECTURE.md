# Yjs document architecture

The workspace uses separate Yjs documents for navigation, databases, views and page content. A board or calendar is a view over a database; it is not a data container.

## Rooms and ownership

| Room | Canonical data | Excludes |
|---|---|---|
| `workspace:{workspaceId}` | Ordered database/view references and navigation | Schemas, rows, view configuration, page content |
| `database:{databaseId}:v2` | Property definitions, rows, property values and per-view ranks | View filters/layout and Lexical content |
| `view:{viewId}` | `databaseId`, view type, grouping/date property, visible properties and presentation settings | Row membership and page content |
| `page-{pageId}` | Lexical/Yjs content and awareness | Database schema and other pages |

The legacy `database:roadmap` room is read only during migration. New writes use versioned database rooms.

## Database layout

Each database document owns:

- `schema-definitions`: one serialized definition per stable property ID.
- `schema-order`: ordered property IDs.
- `pages`: one nested `Y.Map` per page containing property values, metadata projection, preview and per-view ranks.
- `page-order`: deterministic fallback ordering.

Status option IDs remain stable when a lane is renamed. Changing a page status updates only that row.

## View layout

A view points to exactly one database through `databaseId`. Its page list is derived from database membership. Views never persist a membership copy.

Board ordering is stored as a rank keyed by `viewId` on the database row. Moving a card can update its grouping property and rank in one database transaction.

A calendar created from an existing date property becomes another view of the owning database. A calendar with a new date property creates a new database.

## Page properties

Database properties belong to the database schema, not to an individual page and not to the workspace. Adding a Status from a database page adds the definition to that database. Values remain per row.

Standalone pages have no database properties. They must be moved into a database before receiving Status, Date, Person or other database fields.

Selecting a different board grouping property changes only the view configuration. Rows without a valid value render in the synthetic `Sem status` lane; the application does not silently rewrite them.

## Creation protocol

Creating a new board:

1. Allocate a database ID and view ID.
2. Create the database room with its initial Status definition.
3. Create the view room pointing to the database.
4. Publish database and view references to the workspace last.

The sequence is idempotent. An interrupted creation can leave an unreferenced document, but never a workspace reference to an uninitialized document.

## Legacy migration

Legacy views stored `pageIds` while every view shared `database:roadmap`. Migration:

1. Reads the legacy database and view rooms without deleting them.
2. Keeps the default board and calendar in the shared `roadmap` database.
3. Gives custom legacy views independent databases.
4. Copies only the referenced rows and properties into each database.
5. Moves unreferenced pages into the standalone database.
6. Writes `databaseId` to workspace and view references.
7. Removes persisted membership from the view.

Repeated initialization detects the migrated references and does not copy again.

## Hocuspocus

Room names and ownership do not depend on the provider. Replacing `BroadcastProvider` with Hocuspocus changes transport and persistence only.

Authorization should validate the room prefix, workspace membership and referenced ID. Awareness is ephemeral and must not be persisted.

## Growth and compaction

Splitting documents limits update history by ownership boundary. Production persistence should monitor encoded document size, update count and load time per room.

When thresholds are exceeded, materialize application state into a new versioned room, update the active reference atomically and retain the previous room for recovery. Merging binary Yjs updates reduces log entries but does not remove all CRDT tombstones.
