---
"@whereby.com/browser-sdk": minor
---

Export `useGridCell`, so a custom cell in `VideoGrid` (from `renderParticipant`, `renderSubgridParticipant` or `renderFloatingParticipant`) can read and change the grid's maximize and float state. For example, a custom participant menu can label its item "Minimize" when `maximizedCellId === participant.id`. `useGridCell` now throws when it's called outside a `GridCell`, as its error message always said.
