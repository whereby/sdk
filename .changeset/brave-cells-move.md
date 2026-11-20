---
"@whereby.com/browser-sdk": minor
---

Add `moveCell(id, targetId)` to `useGrid` and `useGridCell`, for building drag-to-reorder on `VideoGrid`. It does what
dropping one tile on another does in the Whereby room: two tiles in the grid swap places for you, two spotlighted tiles
on the stage swap for everyone (hosts only), swapping with the maximized tile moves the maximize, and dropping a tile on
the room integration on the stage (or the integration on a tile) maximizes that tile. Drops on or from the subgrid or
the floating tile do nothing. `GridCell` now always has a `data-cell-id` attribute, defaulting to the participant's id,
for finding the tile under the pointer.
