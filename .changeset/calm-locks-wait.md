---
"@whereby.com/browser-sdk": minor
---

`useRoomConnection` initializes the client on mount, so `state.isLocked` is known before `joinRoom()`.
