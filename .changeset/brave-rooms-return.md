---
"@whereby.com/browser-sdk": minor
---

`connectionStatus` in `useRoomConnection` state is now `reconnecting` while the SDK retries a dropped connection, and
`disconnected` only once it has stopped retrying.
