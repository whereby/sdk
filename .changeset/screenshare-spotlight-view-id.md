---
"@whereby.com/core": patch
"@whereby.com/browser-sdk": patch
---

Fix spotlighting a screenshare. `spotlightParticipant(id)` and `removeSpotlight(id)` (on `GridClient`, `RoomConnectionClient` and `useRoomConnection`) take a client view id: the participant's id for their camera, as before, or the screenshare's view id (`pres-<participantId>`) for their screenshare. Spotlight in `VideoGrid`'s participant menu now works on screenshare tiles, and spotlighting a camera no longer depends on the order of the client views.
