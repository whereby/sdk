---
"@whereby.com/core": minor
---

Only notify `RoomConnectionClient`, `LocalMediaClient` and `GridClient` subscribers and event listeners when their value changes. Before, `RoomConnectionClient` notified the remote participants, local participant, breakout, cloud recording, live captions, live transcription, live stream and local screenshare subscribers, and emitted their events, on every change to the room connection state. The screenshares, spotlighted participants and running room integrations were also rebuilt, and notified, whenever any participant changed.

Add `subscribeToKnockResponse` and `subscribeToRoomIntegrations` to `RoomConnectionClient`, and the `CHAT_MESSAGES_CHANGED`, `FILE_UPLOADS_CHANGED`, `CONNECTION_KNOCK_RESPONSE_CHANGED` and `ROOM_INTEGRATIONS_CHANGED` events, so every part of the room connection state has a subscriber and an event.
