# Notion Pages fidelity map

This repository now runs the real React/Lexical components. The table separates implemented behavior from the larger Notion product surface.

| Area | Status | Notes |
|---|---|---|
| Page title, icon and cover | Implemented | Editable emoji; cover accepts URL or local image |
| Cover repositioning | Implemented | Vertical position persisted |
| Text, number, URL, email and phone properties | Implemented | Editable fields and compact card rendering |
| Select and multi-select | Implemented | Create, rename, recolor, delete and select options |
| Status | Implemented | Grouped options and new option assignment |
| Date | Partial | Single date; range, time and reminders remain |
| Person | Implemented | Multi-person selection from workspace people |
| Checkbox | Implemented | Editable and persisted |
| Created/edited timestamps | Implemented | System managed |
| Property schema CRUD | Implemented | Add, rename, change compatible types, reorder and delete |
| Empty-property visibility | Implemented | Reveal and hide empty fields |
| Board cards | Implemented | Status columns and card drag between columns |
| Rich-text editor | Implemented | Real Lexical state, slash menu and custom nodes |
| Images, embeds, bookmarks and math | Implemented | URL-based MVP nodes |
| Local persistence | Implemented | Separate workspace, database, view and page Yjs rooms |
| Real-time collaboration | Implemented locally | Yjs over BroadcastChannel; Hocuspocus transport adapter is ready |
| Files property | Missing | Requires upload/storage contract |
| Formula | Missing | Requires expression engine and dependency graph |
| Relation and rollup | Missing | Requires database identity and query layer |
| Created-by / edited-by | Missing | Requires authenticated workspace identity |
| Unique ID | Missing | Requires server-side sequence allocation |
| Button property and automations | Missing | Requires action/workflow runtime |
| Comments, mentions and notifications | Partial | Person mentions exist; comment threads and notifications remain |
| Permissions and sharing | Missing | Requires backend authorization model |

“100% Notion” is not a bounded frontend task because several properties depend on storage, identity, queries and automation services. The current target is full fidelity for the property types represented by `PropertyType` in this package.
