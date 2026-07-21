## Fix Morning Intent bucket to be topic-level

Currently `src/components/MorningIntent.tsx` treats any node without children as a leaf and adds it to the bucket. With the locked 4-level schema (Subject > Chapter > Topic > Subtopic), that means subtopics are getting added instead of topics. The revision engine already expects **topics** in the bucket (it renders subtopics as a checklist inside each topic card).

### Changes (only `src/components/MorningIntent.tsx`)

1. **Treat topics (depth === 2) as the addable unit** in The Bank, regardless of whether they have subtopic children.
   - In `filterTree`, `countLeaves`, and `BankNode`, define "leaf" as `node.depth === 2` instead of "has no children".
   - Topics render with the `+` / `−` button and StatusDot; their subtopics are not shown in the Bank (they belong to the revision card checklist).
   - Subjects (0) and Chapters (1) remain expandable group headers with chevrons and leaf counts.

2. **Status/due filters apply at the topic level** — `newTree` keeps topics with `status === "unread"`, `dueTree` keeps topics with `dueToday && status !== "unread"`. Subtopic status is ignored here.

3. **Bucket rendering** already uses `bucketNodes` from the store; no logic change needed, but confirm the item card shows the topic title and type ("topic").

### Out of scope

- No store changes — `addToBucket`/`bucketNodes` already accept any id.
- No revision engine changes — it already filters subtopics per topic.
- No syllabus manager changes.