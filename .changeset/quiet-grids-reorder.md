---
"@whereby.com/core": minor
---

Add tile ordering to `GridClient`. `reorderClientViews({ id, targetId })` swaps two client views and
`setClientViewOrder(ids)` sets the order, for this participant only. `allClientViews` follows the order: client views
not in it go at the end, and the views keep their ids, so video elements don't remount. Hosts can also swap two
spotlighted client views for the whole room with `swapSpotlightOrder({ id, targetId })`, and the grid state has a new
`canSpotlight` field.
