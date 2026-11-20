---
"@whereby.com/core": minor
---

Fetch the room when `RoomConnectionClient.initialize()` gets a new room URL, so `isLocked` is known before joining.
Add `isLocked` to the room connection state, `subscribeToRoomLock` and the `room-lock:changed` event.
