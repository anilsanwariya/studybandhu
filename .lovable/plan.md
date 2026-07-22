## Admin syllabus editor: type changes, cascade-promote on delete, multi-select

Enhance `src/routes/admin.index.tsx` so admins can restructure the tree more freely while keeping the fixed 4-level schema (Subject > Chapter > Topic > Subtopic) as the depth ceiling.

### 1. Change a node's type (level)

On each `NodeRow`, add a small level selector (compact dropdown showing the current label — Subject / Chapter / Topic / Subtopic).

- Changing the level changes that node's `depth` and re-cascades depth for all descendants (children shift by the same delta).
- Guards:
  - Final depth of the node and every descendant must stay within `0..3`. If a change would push any subtopic past depth 3, block it with a toast ("Would exceed subtopic level — remove deeper items first").
  - When promoting to a shallower level (e.g. Chapter → Subject), the node is re-parented to the correct ancestor so its new depth matches its parent chain: promoting to Subject moves it to the tree root; promoting a Subtopic to Topic moves it under its current chapter; etc. Position among new siblings = right after its former parent.
  - When demoting to a deeper level (e.g. Subject → Chapter), it becomes a child of its previous sibling (nearest preceding node at the required parent depth). If no valid parent exists, block with a toast.
- `node_type` is rewritten from `SCHEMA[newDepth]` for the node and every descendant.

### 2. Delete cascade → promote children

Replace the current "delete node and all descendants" behavior with "delete this node, promote its children up one level":

- Removing a Subject: each child Chapter becomes a Subject at the tree root (in place of the deleted subject, preserving order). Their descendants shift up by one depth too (Topic → Chapter, Subtopic → Topic).
- Same rule applies at any level. Subtopics of a deleted Topic become Topics under the Topic's former chapter.
- All promoted nodes get their `node_type` rewritten to match new depth.
- Trash icon still triggers this; keep a confirm for multi-select but single-node delete stays one-click (matches current UX).

### 3. Multi-select edit & delete

Add selection state at the editor level:

- Checkbox on each `NodeRow` (leftmost). A toolbar appears above the tree when >=1 row is selected: **selected count**, **Change level to…** (Subject/Chapter/Topic/Subtopic), **Delete selected**, **Clear**.
- Bulk change-level runs the same guard logic per node; nodes that would violate depth bounds are skipped and reported in a single toast summary ("3 changed, 2 skipped").
- Bulk delete runs the cascade-promote rule per node, processed deepest-first so promotions don't collide.
- Selecting a parent does NOT auto-select children — each row is independent, but a "Select subtree" affordance (shift-click on the checkbox) selects the node plus all descendants for convenience.

### 4. Save flow

No schema changes. The existing Save button already deletes and re-inserts all rows for the exam with fresh `depth` / `node_type` / `parent_id` / `sort_order`, so all the above only needs to keep the in-memory `tree` valid before Save. AI-parse and existing add/rename paths are unchanged.

### Out of scope

- No changes to student-facing routes, store, or server functions.
- No changes to the schema constant (still Subject > Chapter > Topic > Subtopic).
- No undo/redo — admins re-edit and Save.

### Technical notes

- Single file: `src/routes/admin.index.tsx`.
- New helpers next to `flattenAi` / `countAll`:
  - `changeNodeLevel(tree, path, newDepth)` — returns a new tree or an error string.
  - `deleteAndPromote(tree, path)` — returns a new tree.
  - `rewriteTypes(nodes, depth)` — recursive, sets `node_type = SCHEMA[depth]` and `depth` for the subtree.
- Selection state: `const [selected, setSelected] = useState<Set<string>>(new Set())` keyed by node id; cleared on tree reload / save.
- `NodeRow` gets `selected`, `onToggleSelect`, `onChangeLevel` props alongside existing ones.