---
"@whereby.com/core": minor
---

Reject `joinRoom()` with `"join_cancelled"` when the room is left, or joined again, before the join has finished.
Before, the promise never settled. The rejection isn't reported as unhandled, so apps that leave without awaiting the
join (on unmount, for example) see no change. The new `JoinRoomErrorNames` type lists the errors the SDK rejects with.
