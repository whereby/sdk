---
"@whereby.com/browser-sdk": patch
---

Join with the latest options passed to `useRoomConnection`. `joinRoom()` used the options from the first render, so
an option that changed afterwards, such as a display name loaded later, was ignored.
