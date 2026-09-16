---
"@whereby.com/assistant-sdk": patch
---

Fix `TypeError: window.addEventListener is not a function` when joining a room. The polyfilled `window` is built by spreading Node's `global`, which is not an EventTarget, so it carried no event methods.
