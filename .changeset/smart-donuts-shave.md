---
"@whereby.com/browser-sdk": minor
"@whereby.com/media": minor
"@whereby.com/core": minor
---

Add room integration support: catalog and running-session state, start/stop/update actions, a
`RoomIntegrationView` component that embeds the integration webview and syncs it over postMessage,
`startRoomIntegrationWithPicker` for starting one through the integration's own picker, and
`roomIntegrationContent` builders for consumers who want to build their own picker UI
