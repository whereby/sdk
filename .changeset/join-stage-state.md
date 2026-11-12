---
"@whereby.com/core": minor
---

Add `joinStage` to the room connection state: the step `joinRoom()` is waiting on (`"credentials"`, `"organization"`,
`"local_media"`, `"signal_connect"`, `"identify_device"` or `"join_room"`), or `null` when no join is in progress.
Apps can use it to tell users what a slow join is waiting for, or to give up on a join after a time they choose. Read it
with `getState()`, `subscribeToJoinStage()` or the `connection:join-stage-changed` event. The `JoinRoomStage` type
lists the values.
