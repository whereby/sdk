---
"@whereby.com/core": minor
---

Add a join timeout, so `joinRoom()` can no longer stay pending forever. When the room isn't joined within
`joinRoomTimeout` milliseconds (default 60000, `0` turns it off), `connectionStatus` becomes `"disconnected"`,
`connectionError` names the step that didn't finish (`join_timeout_credentials`, `join_timeout_organization`,
`join_timeout_local_media`, `join_timeout_signal_connect`, `join_timeout_identify_device` or
`join_timeout_room_joined`) and `joinRoom()` rejects with the same value. Set the option with `initialize()`. The
`JoinRoomError` and `JoinRoomStage` types list the values.
