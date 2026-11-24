---
"@whereby.com/core": minor
---

Add `cameraPermission` and `microphonePermission` to the local media state, known before media starts: `"granted"`,
`"denied"` or `"prompt"` (not asked yet), and `null` until the browser has answered. Browsers that can't report the
permission for a device read as `"prompt"`. Add `subscribeCameraPermission`, `subscribeMicrophonePermission` and the
`local-media:camera-permission-changed` and `local-media:microphone-permission-changed` events to `LocalMediaClient`.
