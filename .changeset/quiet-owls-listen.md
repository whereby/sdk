---
"@whereby.com/core": minor
---

Only notify `RoomConnectionClient` subscribers and event listeners when their value changes. Before, the remote participants, local participant, breakout, cloud recording, live captions, live transcription, live stream and local screenshare subscribers were notified, and their events emitted, on every change to the room connection state. The running room integrations of `RoomConnectionClient` and `GridClient`, and `selectRunningRoomIntegrations`, now also only change when a session or its presenter changes, rather than whenever any remote participant changes.

Add `subscribeToKnockResponse` and `subscribeToRoomIntegrations` to `RoomConnectionClient`, and the `CHAT_MESSAGES_CHANGED`, `FILE_UPLOADS_CHANGED`, `CONNECTION_KNOCK_RESPONSE_CHANGED` and `ROOM_INTEGRATIONS_CHANGED` events, so every part of the room connection state has a subscriber and an event.
