---
"@whereby.com/browser-sdk": minor
---

`useRoomConnection` has a new `state.isLocked`, whether the room is locked, so an app can show Knock or Join before
`joinRoom()`. It's `null` until known. The hook initializes the client when it mounts, and again when the room URL
changes, so the room is fetched before joining. This means mounting the hook now makes requests to the Whereby API
(registering the device, and fetching the organization and the room) before the user joins.
