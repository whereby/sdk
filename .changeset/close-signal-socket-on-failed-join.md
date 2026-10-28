---
"@whereby.com/core": patch
---

Close the signal socket when a join fails, or when `leaveRoom()` is called before the socket has connected. The socket
kept reconnecting in the background, so a failed join could later change `connectionStatus` from `"disconnected"` to
`"reconnecting"` and stay there.
