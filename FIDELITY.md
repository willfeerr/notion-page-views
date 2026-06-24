# Notion Pages fidelity map

This repository now runs the real React/Lexical components. The table separates implemented behavior from the larger Notion product surface.

| Area | Status | Notes |
|---|---|---|
| Page title, icon and cover | Implemented | Editable emoji; cover accepts URL or local image |
| Cover repositioning | Implemented | Vertical position persisted |
| Text, number, URL, email and phone properties | Implemented | Editable fields and compact card rendering |
| Select and multi-select | Implemented | Create, rename, recolor, delete and select options |
| Status | Implemented | Grouped options and new option assignment |
| Date | Partial | Date ranges, time and timezone are supported; reminders remain |
| Person | Implemented | Multi-person selection from workspace people |
| Checkbox | Implemented | Editable and persisted |
| Created/edited timestamps | Implemented | System managed |
| Property schema CRUD | Implemented | Add, rename, change compatible types, reorder and delete |
| Empty-property visibility | Implemented | Reveal and hide empty fields |
| Board cards | Implemented | Status columns and card drag between columns |
| View query engine | Implemented | Nested AND/OR filters, multiple stable sorts, grouping and projection are persisted per view |
| Table, List and Gallery | Implemented | Independent projections over a shared Data Source |
| Timeline and Chart | Implemented | Timeline plus bar, line and donut charts with count, sum and average aggregation |
| Page open mode | Implemented | Full page, side peek and center peek are configurable per view |
| Database page layout | Implemented | Up to four pinned properties and configurable collapsible sections persist per Data Source |
| Database page templates | Implemented | Capture and reuse page metadata, editable properties and Lexical content with regenerated identity/audit fields |
| Rich-text editor | Implemented | Real Lexical state, slash menu and custom nodes |
| Images, embeds, bookmarks and math | Implemented | URL-based MVP nodes |
| Local persistence | Implemented | Schema/page snapshot plus persisted binary Yjs state per room |
| Real-time collaboration | Implemented locally | Yjs over BroadcastChannel; Hocuspocus transport adapter is ready |
| Database / Data Source separation | Implemented | Versioned container and source rooms with explicit IDs |
| Canonical page ownership | Implemented | Membership comes from `pageId -> dataSourceId`, never a view list or room scan |
| Multiple views on one source | Implemented | Rows are shared while view configuration remains independent |
| v2 source migration | Implemented | Idempotent copy to `datasource:{id}:v1`; legacy rooms remain recoverable |
| Recoverable schema removal | Implemented | Removed values are archived by stable property ID and restored when re-added |
| Files property | Partial | URL-backed values work; binary upload still requires object storage |
| Formula | Partial | Typed expression AST and arithmetic/concat evaluation work; full Notion function library remains |
| Relation and rollup | Implemented locally | Relations preserve ownership; rollups derive values from related pages |
| Recoverable cross-source move | Implemented locally | Journaled saga, mapping confirmation, conflict handling, resume and undo |
| Created-by / edited-by | Implemented locally | Uses the current collaboration identity; authenticated server identity remains |
| Unique ID | Partial | Deterministic IDs work locally; authoritative server allocation remains |
| Place | Implemented | Structured place value and editor |
| Button property and automations | Missing | Requires action/workflow runtime |
| Comments, mentions and notifications | Partial | Person mentions exist; comment threads and notifications remain |
| View settings scope | Partial | Saved shared settings work; per-user personal view settings remain |
| Permissions and sharing | Missing | Requires backend authorization model |

“100% Notion” is not a bounded frontend task because several properties depend on storage, identity, queries and automation services. The current target is full fidelity for the property types represented by `PropertyType` in this package.
