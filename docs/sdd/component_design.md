# Component Design (Draft)

Frontend
- AppShell
- PdfViewer
- NotePanel
- NoteCardSidebar (free / follow mode)

Backend
- workspace_manager
- note_manager
- search_engine

Notes
- In single-page mode, `PdfViewer` exposes the current page and selection anchor (`page`, `y_top_norm`) for `NoteCardSidebar`.

> TODO: Add responsibilities and APIs.
