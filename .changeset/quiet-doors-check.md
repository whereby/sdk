---
"@whereby.com/core": minor
---

Add `isLocked` to the room connection state, with `subscribeToRoomLock` and the `room-lock:changed` event, so an app
knows before `joinRoom()` whether it will have to knock. It's `null` until known, and for a room that doesn't exist,
is banned or couldn't be fetched.

`RoomConnectionClient.initialize()` now fetches the room from the Whereby API when given a new room URL, or the same
URL after a failed fetch. While in a room it waits until leaving, and assistants and Node.js participants skip it.
In a room, the signal server keeps `isLocked` current, and it keeps its last value after leaving.
`createServices()` returns the new `fetchRoomFromRoomUrl` it uses, and `@whereby.com/core/redux` exports
`selectRoomLockState`.

`RoomConnectionState.isLocked` and the new `RoomState` fields are required, so code that builds these objects by hand,
such as test mocks or a preloaded store state, needs them added. `selectRoomIsLocked` can now be `true` before joining,
from the fetched room.
