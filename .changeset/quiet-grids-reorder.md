---
"@whereby.com/core": minor
---

Add tile ordering to `GridClient`. `reorderClientViews({ id, targetId })` swaps two client views and
`setClientViewOrder(ids)` puts the listed client views first, for this participant only. `allClientViews` follows the
order: unlisted client views keep their current order, and new ones go at the end. The views keep their ids, so video
elements don't remount. Hosts can also swap two
spotlighted client views for the whole room with `swapSpotlightOrder({ id, targetId })`, and the grid state has a new
`canSpotlight` field.
