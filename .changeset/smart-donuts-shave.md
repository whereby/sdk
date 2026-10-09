---
"@whereby.com/browser-sdk": minor
"@whereby.com/media": minor
"@whereby.com/core": minor
---

Add room integrations, for sharing a YouTube video or a Miro board with everyone in the room.

- `@whereby.com/core`: `roomIntegrations` state (enabled and running integrations, `error`) and the `startRoomIntegration`, `stopRoomIntegration` and `updateRoomIntegrationProps` actions. Errors carry a `code` as well as a `message`. `roomIntegrationContent.youtube()` and `roomIntegrationContent.miro()` build the content to start without a picker, for example from the Node SDK.
- `@whereby.com/browser-sdk`: `useRoomIntegrationView` and `useRoomIntegrationPicker`, headless hooks that return `iframeProps` for an iframe you render, and `subscribeToRoomIntegrationPicker` for use outside React. `VideoGrid` shows a running integration on the stage, in a frame it renders for you. Pass `renderIntegration` to render it yourself, or `enableIntegrations={false}` to keep integrations out of the grid. `useGrid` is now exported, and returns integration cells when called with `includeIntegrations: true`.
- `@whereby.com/media`: room integration signal event and request types.
