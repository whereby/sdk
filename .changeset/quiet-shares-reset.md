---
"@whereby.com/browser-sdk": patch
---

Stop a new screenshare from starting maximized or floating. The grid now forgets a maximized or floating cell once its view leaves the room, so when a participant shares again (and gets the same view id), the new share starts unmaximized and the first "Maximize" click maximizes it.
