---
"@whereby.com/browser-sdk": patch
---

Fix an empty grid when it mounts after the client views have settled. useGridParticipants now
seeds its state from the current grid snapshot instead of waiting for the next change event.
