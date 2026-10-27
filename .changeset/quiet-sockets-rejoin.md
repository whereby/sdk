---
"@whereby.com/core": minor
---

Report the local reconnect lifecycle. `connectionStatus` is now `reconnecting` as soon as the signal connection drops
and while it retries, and `disconnected` only when the SDK has stopped retrying. A new `reconnecting` notification is
sent when the connection drops while in the room. A new `room:rejoined` client event (with `selfId`, `previousSelfId`
and `selfIdChanged`) fires once the room has been joined again, and a new `reconnected` notification is sent at the
same time. `signalOk` still fires when the socket reconnects.
