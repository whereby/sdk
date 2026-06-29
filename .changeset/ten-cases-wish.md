---
"@whereby.com/core": patch
---

Fix camera effects being lost when the camera is toggled off and on.

The active effect is now remembered while the camera is off and automatically re-applied to the new camera track when the camera is turned back on, so effects keep working (and can still be changed) after a toggle.
