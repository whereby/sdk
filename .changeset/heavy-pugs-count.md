---
"@whereby.com/browser-sdk": minor
"@whereby.com/core": minor
---

Add a headless pre-call network test: `PreCallTestClient` (via `client.getPreCallTest()`) in core, and the `usePreCallTest` hook in browser-sdk. It measures available bitrate and packet loss against the Whereby media servers before joining a room, without needing a room or local media.
