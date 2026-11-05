---
"@whereby.com/browser-sdk": minor
---

Add the `joinRoomTimeout` option to `useRoomConnection`. It sets how long `joinRoom()` waits for the room to be joined
before it rejects with `join_timeout_<stage>`. Defaults to 60000 milliseconds, and `0` turns it off.
