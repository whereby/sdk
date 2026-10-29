---
"@whereby.com/media": patch
---

Make `hasGetDisplayMedia` safe to call where `navigator` or `navigator.mediaDevices` is missing, such as Node.js
