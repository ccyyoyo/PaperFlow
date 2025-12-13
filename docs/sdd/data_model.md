# Data Model (Draft)

Tables
- workspace(id, name)
- paper(id, workspace_id, path)
- note(id, paper_id, page, anchor_y_top_norm, content)
- paper_fingerprint(paper_id, fingerprint) (optional)
- search_index(content, ref_type, ref_id)

Notes
- `anchor_y_top_norm` is `0..1` (top edge of selected text relative to page height) for card sidebar alignment.
- Store a PDF fingerprint (hash) to detect when anchors may drift after the PDF changes.

> TODO: Add migrations and indexes.
