---
"@whereby.com/browser-sdk": minor
"@whereby.com/core": minor
---

Add a headless pre-call network test: `PreCallTestClient` (via `client.getPreCallTest()`) in core, and the `usePreCallTest` hook in browser-sdk. It measures available bitrate and packet loss against the Whereby media servers before joining a room, without needing a room or local media.

The test requires a browser (it captures a canvas as its video track). Use the new `isPreCallTestSupported()` export to check up front; in Node or React Native, starting a test fails with `error.reason === "unsupported"`.
