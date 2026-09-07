---
"@whereby.com/core": minor
"@whereby.com/browser-sdk": minor
---

Fix the local participant's camera and microphone state when joining muted.

`toggleCamera(false)` / `toggleMicrophone(false)` are now idempotent - an explicit
`false` while already off no longer turns the device back on - and the local
participant adopts the mute state it joined with, so the in-call controls and the
local grid tile match the tracks.

Adds `initialMuteStates` to `RoomConnectionOptions`, `WherebyClientOptions` and
`AppConfig`, for joining with the camera and/or microphone muted while still acquiring
the devices.

Adds `isCameraEnabled` and `isMicrophoneEnabled` to the local media state, so a pre-call
UI can render what `toggleCameraEnabled` / `toggleMicrophoneEnabled` have set.
