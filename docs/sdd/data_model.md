# Data Model (Draft)

Tables
- workspace(id, name)
- paper(id, workspace_id, path)
- note(id, paper_id, page, x, y, content)
- search_index(content, ref_type, ref_id)

> TODO: Add migrations and indexes.
