# Yjs document architecture

The demo no longer stores the workspace as one serialized snapshot. Each ownership boundary has its own Y.Doc and can later map directly to one Hocuspocus document.

| Room | Owns | Does not own |
|---|---|---|
| `workspace:notion-pages-lab` | Workspace identity and references to databases/views | Rows, schema, view state, page content |
| `database:roadmap` | Ordered property definitions and page records | Lexical content and view configuration |
| `view:{viewId}` | Board/calendar title, type and linked page IDs | Page records and content |
| `page-{pageId}` | Lexical/Yjs content for one page | Database schema and other pages |

## Database layout

The database room uses granular Yjs collections:

- `schema-definitions`: one serialized property definition per property ID.
- `schema-order`: ordered property IDs.
- `pages`: one nested Y.Map per page containing title, icon, cover, properties, timestamps and a derived text preview.
- `page-order`: ordered page IDs.

A property edit updates one page entry. A schema-option edit updates one schema entry. Neither operation rewrites the other pages or any Lexical document.

## Page content

The full Lexical state is never copied into the database room. Each open page connects only to `page-{pageId}`. The board receives a debounced plain-text preview capped at 240 characters, so it can render cards without loading every page document.

The existing `page-{pageId}` name is intentionally preserved so locally edited page content survives this migration. Board and calendar rooms remain projections over the shared database room.

## Hocuspocus migration

Room names and data ownership stay unchanged. Switching a page or application room from `BroadcastProvider` to `HocuspocusProvider` only changes transport and persistence configuration.

The server should authorize every room from its prefix and identifier. Awareness remains ephemeral and must not be written to durable storage.

## Growth and compaction

Splitting rooms limits the blast radius but does not make Yjs history free. Production persistence should monitor encoded document size and update count per room.

When a room crosses a threshold, create a new versioned room from application-level state, atomically update its active-room reference, and retain the previous room for recovery. Simply merging Yjs updates into one binary update reduces log entries but does not fully remove CRDT history.

Very large databases can later shard `pages` into stable buckets while keeping schema and view rooms unchanged.
